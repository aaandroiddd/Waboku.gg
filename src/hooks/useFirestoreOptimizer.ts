import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, getDocs, query, collection, where, limit, documentId } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { registerGlobalListener } from './useFirestoreListenerCleanup';

// Global cache for all Firestore data
interface FirestoreCache {
  users: Record<string, { data: any; timestamp: number }>;
  sellerStatus: Record<string, { hasStripeAccount: boolean; timestamp: number }>;
  listings: Record<string, { data: any; timestamp: number }>;
  similarListings: Record<string, { data: any[]; timestamp: number }>;
}

// Cache expiration times
const CACHE_EXPIRY = {
  users: 30 * 60 * 1000, // 30 minutes
  sellerStatus: 30 * 60 * 1000, // 30 minutes
  listings: 5 * 60 * 1000, // 5 minutes
  similarListings: 2 * 60 * 60 * 1000 // 2 hours
};

// Initialize cache from localStorage if available
const initializeCache = (): FirestoreCache => {
  try {
    const storedCache = localStorage.getItem('firestoreCache');
    if (storedCache) {
      const parsedCache = JSON.parse(storedCache);
      console.log('[FirestoreOptimizer] Loaded cache from localStorage');
      return parsedCache;
    }
  } catch (e) {
    console.warn('[FirestoreOptimizer] Error loading cache from localStorage:', e);
  }
  
  return {
    users: {},
    sellerStatus: {},
    listings: {},
    similarListings: {}
  };
};

// Global cache instance
const globalCache: FirestoreCache = initializeCache();

// Throttled function to persist cache to localStorage
let persistTimeout: NodeJS.Timeout | null = null;
const persistCache = () => {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
  }
  
  persistTimeout = setTimeout(() => {
    try {
      localStorage.setItem('firestoreCache', JSON.stringify(globalCache));
      console.log('[FirestoreOptimizer] Cache persisted to localStorage');
    } catch (e) {
      console.warn('[FirestoreOptimizer] Error persisting cache to localStorage:', e);
    }
    persistTimeout = null;
  }, 2000);
};

// Create a flag to track if we're already fetching user data for specific IDs
const fetchingUserIds = new Set<string>();

// Batch user data fetching with request deduplication
export const batchFetchUserData = async (userIds: string[]): Promise<void> => {
  if (!userIds.length) return;
  
  // Filter out users that are already in cache and not expired
  // Also filter out users that are currently being fetched
  const now = Date.now();
  const uncachedUserIds = userIds.filter(id => {
    if (fetchingUserIds.has(id)) return false;
    return !globalCache.users[id] || now - globalCache.users[id].timestamp >= CACHE_EXPIRY.users;
  });
  
  if (!uncachedUserIds.length) return;
  
  console.log(`[FirestoreOptimizer] Batch fetching data for ${uncachedUserIds.length} users`);
  
  // Mark these users as being fetched
  uncachedUserIds.forEach(id => fetchingUserIds.add(id));
  
  try {
    const { db } = getFirebaseServices();
    if (!db) throw new Error('Firebase DB not initialized');
    
    // Process in batches of 10 (Firestore limit for 'in' queries)
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < uncachedUserIds.length; i += BATCH_SIZE) {
      const batchIds = uncachedUserIds.slice(i, i + BATCH_SIZE);
      
      // Fetch user data
      const usersQuery = query(
        collection(db, 'users'),
        where(documentId(), 'in', batchIds)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        
        // Extract user data
        const userData = {
          username: data.displayName || data.username || `User ${doc.id.substring(0, 6)}...`,
          avatarUrl: data.avatarUrl || data.photoURL || null,
          email: data.email || null,
          // Also store Stripe seller status in the same request
          stripeConnectAccountId: data.stripeConnectAccountId || null,
          stripeConnectStatus: data.stripeConnectStatus || null,
          hasStripeAccount: !!(data.stripeConnectAccountId && data.stripeConnectStatus === 'active')
        };
        
        // Update user cache
        globalCache.users[doc.id] = {
          data: userData,
          timestamp: now
        };
        
        // Also update seller status cache
        globalCache.sellerStatus[doc.id] = {
          hasStripeAccount: userData.hasStripeAccount,
          timestamp: now
        };
      });
      
      // For any users not found in the query, set a placeholder
      batchIds.forEach(id => {
        if (!globalCache.users[id]) {
          globalCache.users[id] = {
            data: {
              username: `User ${id.substring(0, 6)}...`,
              avatarUrl: null,
              hasStripeAccount: false
            },
            timestamp: now - (CACHE_EXPIRY.users / 2) // Expire sooner
          };
          
          globalCache.sellerStatus[id] = {
            hasStripeAccount: false,
            timestamp: now - (CACHE_EXPIRY.sellerStatus / 2)
          };
        }
      });
    }
    
    // Persist updated cache
    persistCache();
  } catch (error) {
    console.error('[FirestoreOptimizer] Error batch fetching user data:', error);
  } finally {
    // Clear the fetching flag for these users
    uncachedUserIds.forEach(id => fetchingUserIds.delete(id));
  }
};

// Also track similar listings fetches
const fetchingSimilarListingsIds = new Set<string>();

// Function to prefetch similar listings with deduplication
export const prefetchSimilarListings = async (listingId: string, game: string, maxListings: number = 6) => {
  // Check if already fetching
  if (fetchingSimilarListingsIds.has(listingId)) {
    // If it's already being fetched, wait for it in cache
    let attempts = 0;
    const maxAttempts = 50; // Maximum wait time: 5 seconds
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      attempts++;
      
      // If it appeared in cache, return it
      const now = Date.now();
      if (globalCache.similarListings[listingId] && 
          now - globalCache.similarListings[listingId].timestamp < CACHE_EXPIRY.similarListings) {
        return globalCache.similarListings[listingId].data;
      }
      
      // If it's no longer being fetched (but not in cache), break and fetch it
      if (!fetchingSimilarListingsIds.has(listingId)) {
        break;
      }
    }
  }
  
  // Check cache first (again, in case we just waited)
  const now = Date.now();
  if (globalCache.similarListings[listingId] && 
      now - globalCache.similarListings[listingId].timestamp < CACHE_EXPIRY.similarListings) {
    console.log(`[FirestoreOptimizer] Using cached similar listings for ${listingId}`);
    return globalCache.similarListings[listingId].data;
  }
  
  // Mark as being fetched
  fetchingSimilarListingsIds.add(listingId);
  
  try {
    console.log(`[FirestoreOptimizer] Fetching similar listings for ${listingId}`);
    
    const { db } = getFirebaseServices();
    if (!db) throw new Error('Firebase DB not initialized');
    
    // Simple query for listings with the same game
    const gameQuery = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      where('game', '==', game),
      where(documentId(), '!=', listingId),
      limit(maxListings * 2)
    );
    
    const querySnapshot = await getDocs(gameQuery);
    
    // Process results
    const results = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        expiresAt: data.expiresAt?.toDate() || new Date(),
        price: Number(data.price) || 0,
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        isGraded: Boolean(data.isGraded),
        gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
        status: data.status || 'active',
        condition: data.condition || 'Not specified',
        game: data.game || 'Not specified',
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        gradingCompany: data.gradingCompany || undefined
      };
    });
    
    // Sort by relevance (simplified)
    const sortedResults = results.sort((a, b) => {
      // Newer listings get priority
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).slice(0, maxListings);
    
    // If we don't have enough similar listings, fetch newest listings as fallback
    let finalResults = [...sortedResults];
    if (sortedResults.length < maxListings) {
      console.log(`[FirestoreOptimizer] Not enough similar listings (${sortedResults.length}/${maxListings}), fetching newest as fallback`);
      
      // Get IDs of listings we already have to avoid duplicates
      const existingIds = new Set(sortedResults.map(listing => listing.id));
      existingIds.add(listingId); // Also exclude current listing
      
      // Fetch newest listings
      const newestListings = await fetchNewestListings(listingId, maxListings * 2);
      
      // Filter out duplicates and add to results until we reach maxListings
      for (const listing of newestListings) {
        if (!existingIds.has(listing.id) && finalResults.length < maxListings) {
          finalResults.push(listing);
          existingIds.add(listing.id);
        }
      }
    }
    
    // Cache the results
    globalCache.similarListings[listingId] = {
      data: finalResults,
      timestamp: now
    };
    
    persistCache();
    
    // Also prefetch user data for these listings
    const userIds = finalResults.map(listing => listing.userId).filter(Boolean);
    if (userIds.length) {
      // Use setTimeout to make this non-blocking
      setTimeout(() => {
        batchFetchUserData(userIds);
      }, 0);
    }
    
    return finalResults;
  } catch (error) {
    console.error('[FirestoreOptimizer] Error fetching similar listings:', error);
    return [];
  } finally {
    // Clear the fetching flag
    fetchingSimilarListingsIds.delete(listingId);
  }
};

// Function to fetch newest listings
export const fetchNewestListings = async (excludeListingId: string, maxListings: number = 6) => {
  try {
    console.log(`[FirestoreOptimizer] Fetching newest listings (excluding ${excludeListingId})`);
    
    const { db } = getFirebaseServices();
    if (!db) throw new Error('Firebase DB not initialized');
    
    // Query for newest active listings
    const newestQuery = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      where(documentId(), '!=', excludeListingId),
      limit(maxListings)
    );
    
    const querySnapshot = await getDocs(newestQuery);
    
    // Process results
    const results = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        expiresAt: data.expiresAt?.toDate() || new Date(),
        price: Number(data.price) || 0,
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        isGraded: Boolean(data.isGraded),
        gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
        status: data.status || 'active',
        condition: data.condition || 'Not specified',
        game: data.game || 'Not specified',
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        gradingCompany: data.gradingCompany || undefined
      };
    });
    
    // Sort by creation date (newest first)
    return results.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (error) {
    console.error('[FirestoreOptimizer] Error fetching newest listings:', error);
    return [];
  }
};

// Hook to get user data with optimized fetching
export const useOptimizedUserData = (userId: string) => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Use a combined dependency array key to prevent unnecessary fetches
  // when the userId doesn't actually change
  const userIdKey = userId || 'none';
  
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    
    // Check cache first
    const now = Date.now();
    if (globalCache.users[userId] && now - globalCache.users[userId].timestamp < CACHE_EXPIRY.users) {
      setUserData(globalCache.users[userId].data);
      setLoading(false);
      return;
    }
    
    // Fetch user data
    const fetchUserData = async () => {
      try {
        // If this user is already being fetched in a batch, wait for it
        if (fetchingUserIds.has(userId)) {
          let attempts = 0;
          const maxAttempts = 50; // Maximum wait time: 5 seconds
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            attempts++;
            
            // If it appeared in cache, use it
            if (globalCache.users[userId] && 
                now - globalCache.users[userId].timestamp < CACHE_EXPIRY.users) {
              if (isMounted) {
                setUserData(globalCache.users[userId].data);
                setLoading(false);
              }
              return;
            }
            
            // If it's no longer being fetched, break and fetch it individually
            if (!fetchingUserIds.has(userId)) {
              break;
            }
          }
        }
        
        // Check cache again in case it was populated while waiting
        if (globalCache.users[userId] && 
            now - globalCache.users[userId].timestamp < CACHE_EXPIRY.users) {
          if (isMounted) {
            setUserData(globalCache.users[userId].data);
            setLoading(false);
          }
          return;
        }
        
        // Mark as being fetched
        fetchingUserIds.add(userId);
        
        // Proceed with individual fetch if needed
        const { db } = getFirebaseServices();
        if (!db) throw new Error('Firebase DB not initialized');
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Extract user data
          const userData = {
            username: data.displayName || data.username || `User ${userId.substring(0, 6)}...`,
            avatarUrl: data.avatarUrl || data.photoURL || null,
            email: data.email || null,
            // Also store Stripe seller status
            stripeConnectAccountId: data.stripeConnectAccountId || null,
            stripeConnectStatus: data.stripeConnectStatus || null,
            hasStripeAccount: !!(data.stripeConnectAccountId && data.stripeConnectStatus === 'active')
          };
          
          // Update cache
          globalCache.users[userId] = {
            data: userData,
            timestamp: now
          };
          
          // Also update seller status cache
          globalCache.sellerStatus[userId] = {
            hasStripeAccount: userData.hasStripeAccount,
            timestamp: now
          };
          
          // Persist cache
          persistCache();
          
          if (isMounted) {
            setUserData(userData);
          }
        } else {
          // User not found
          const fallbackData = {
            username: `User ${userId.substring(0, 6)}...`,
            avatarUrl: null,
            hasStripeAccount: false
          };
          
          // Cache with shorter expiration
          globalCache.users[userId] = {
            data: fallbackData,
            timestamp: now - (CACHE_EXPIRY.users / 2)
          };
          
          globalCache.sellerStatus[userId] = {
            hasStripeAccount: false,
            timestamp: now - (CACHE_EXPIRY.sellerStatus / 2)
          };
          
          persistCache();
          
          if (isMounted) {
            setUserData(fallbackData);
          }
        }
      } catch (error) {
        console.error('[FirestoreOptimizer] Error fetching user data:', error);
        
        // Fallback data on error
        const fallbackData = {
          username: `User ${userId.substring(0, 6)}...`,
          avatarUrl: null,
          hasStripeAccount: false
        };
        
        if (isMounted) {
          setUserData(fallbackData);
        }
      } finally {
        // Clear the fetching flag
        fetchingUserIds.delete(userId);
        
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchUserData();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [userIdKey]);
  
  return { userData, loading };
};

// Add debugging counter to track fetch requests
let fetchCounter = 0;
const debugFetch = (message: string) => {
  fetchCounter++;
  console.log(`[FETCH DEBUG #${fetchCounter}] ${message}`);
};

// Hook for optimized similar listings fetching
export const useOptimizedSimilarListings = (options: {
  id: string;
  game: string;
  maxCount: number;
} | null) => {
  const [similarListings, setSimilarListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
  
  // Stable reference that doesn't change between renders
  const fetchRef = useRef({
    inProgress: false,
    listingId: null as string | null,
  });
  
  // Use a callback to prevent dependency issues
  const fetchListings = useCallback(async () => {
    if (!options?.id || !options?.game) {
      setIsLoading(false);
      return;
    }
    
    const listingId = options.id;
    const game = options.game;
    const maxListings = options.maxCount || 6;
    
    debugFetch(`Fetch attempt for listing ${listingId}`);
    
    // Skip if we're already fetching this listing
    if (fetchRef.current.inProgress && fetchRef.current.listingId === listingId) {
      debugFetch(`Skipping duplicate fetch for ${listingId} - already in progress`);
      return;
    }
    
    // Check cache first
    const now = Date.now();
    if (
      globalCache.similarListings[listingId] && 
      now - globalCache.similarListings[listingId].timestamp < CACHE_EXPIRY.similarListings
    ) {
      debugFetch(`Using cached data for ${listingId}`);
      setSimilarListings(globalCache.similarListings[listingId].data);
      setIsLoading(false);
      setHasAttemptedFetch(true);
      return;
    }
    
    // Mark as fetching
    fetchRef.current.inProgress = true;
    fetchRef.current.listingId = listingId;
    debugFetch(`Starting actual fetch for ${listingId}`);
    
    try {
      console.log(`[FirestoreOptimizer] Fetching similar listings for ${listingId}`);
      
      const { db } = getFirebaseServices();
      if (!db) throw new Error('Firebase DB not initialized');
      
      // Simple query for listings with the same game
      const gameQuery = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('game', '==', game),
        where(documentId(), '!=', listingId),
        limit(maxListings * 2)
      );
      
      // Wrap the query in a promise that can be cancelled
      const queryPromise = new Promise<any>((resolve, reject) => {
        const queryTask = getDocs(gameQuery);
        
        // Register this as a cancellable operation
        const pageId = `similar-listings-${listingId}`;
        registerGlobalListener(pageId, () => {
          // This is a no-op for one-time queries, but good practice
          console.log(`[FirestoreOptimizer] Cancelling similar listings query for ${listingId}`);
        });
        
        queryTask.then(resolve).catch(reject);
      });
      
      const querySnapshot = await queryPromise;
      debugFetch(`Received ${querySnapshot.docs.length} results for ${listingId}`);
      
      // Process results
      const results = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          price: Number(data.price) || 0,
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          isGraded: Boolean(data.isGraded),
          gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
          status: data.status || 'active',
          condition: data.condition || 'Not specified',
          game: data.game || 'Not specified',
          city: data.city || 'Unknown',
          state: data.state || 'Unknown',
          gradingCompany: data.gradingCompany || undefined
        };
      });
      
      // Sort by relevance (simplified)
      const sortedResults = results.sort((a, b) => {
        // Newer listings get priority
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }).slice(0, maxListings);
      
      // If we don't have enough similar listings, fetch newest listings as fallback
      let finalResults = [...sortedResults];
      if (sortedResults.length < maxListings) {
        debugFetch(`Not enough results (${sortedResults.length}/${maxListings}), fetching newest listings`);
        
        // Get IDs of listings we already have to avoid duplicates
        const existingIds = new Set(sortedResults.map(listing => listing.id));
        existingIds.add(listingId); // Also exclude current listing
        
        // Fetch newest listings
        const newestListings = await fetchNewestListings(listingId, maxListings * 2);
        
        // Filter out duplicates and add to results until we reach maxListings
        for (const listing of newestListings) {
          if (!existingIds.has(listing.id) && finalResults.length < maxListings) {
            finalResults.push(listing);
            existingIds.add(listing.id);
          }
        }
      }
      
      // Cache the results
      globalCache.similarListings[listingId] = {
        data: finalResults,
        timestamp: now
      };
      
      try {
        localStorage.setItem('firestoreCache', JSON.stringify(globalCache));
        debugFetch(`Cached ${finalResults.length} listings for ${listingId}`);
      } catch (e) {
        console.warn('[FirestoreOptimizer] Error saving to localStorage:', e);
      }
      
      setSimilarListings(finalResults);
    } catch (error) {
      console.error('[FirestoreOptimizer] Error fetching similar listings:', error);
      debugFetch(`Error fetching similar listings for ${listingId}: ${error}`);
      setSimilarListings([]);
    } finally {
      fetchRef.current.inProgress = false;
      setIsLoading(false);
      setHasAttemptedFetch(true);
      debugFetch(`Fetch completed for ${listingId}`);
    }
  }, [options]);
  
  useEffect(() => {
    if (!hasAttemptedFetch && options?.id && options?.game) {
      debugFetch(`Initial fetch trigger for ${options.id}`);
      fetchListings();
    }
  }, [hasAttemptedFetch, options, fetchListings]);
  
  return { similarListings, isLoading, refetch: fetchListings };
};

// Hook to get seller status with optimized fetching
export const useOptimizedSellerStatus = (userId: string) => {
  const [hasStripeAccount, setHasStripeAccount] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Use a combined dependency array key
  const userIdKey = userId || 'none';
  
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    let isMounted = true;
    
    // Check cache first
    const now = Date.now();
    if (globalCache.sellerStatus[userId] && now - globalCache.sellerStatus[userId].timestamp < CACHE_EXPIRY.sellerStatus) {
      setHasStripeAccount(globalCache.sellerStatus[userId].hasStripeAccount);
      setIsLoading(false);
      return;
    }
    
    // Check if we already have user data with seller status
    if (globalCache.users[userId] && now - globalCache.users[userId].timestamp < CACHE_EXPIRY.users) {
      const userData = globalCache.users[userId].data;
      if (userData.hasStripeAccount !== undefined) {
        setHasStripeAccount(userData.hasStripeAccount);
        
        // Update seller status cache
        globalCache.sellerStatus[userId] = {
          hasStripeAccount: userData.hasStripeAccount,
          timestamp: now
        };
        
        setIsLoading(false);
        return;
      }
    }
    
    // If this user is already being fetched via user data, wait for it
    if (fetchingUserIds.has(userId)) {
      const waitForUserFetch = async () => {
        let attempts = 0;
        const maxAttempts = 50; // Maximum wait time: 5 seconds
        
        while (attempts < maxAttempts && fetchingUserIds.has(userId)) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
          attempts++;
          
          // Check if we have the data now
          if (globalCache.sellerStatus[userId] && 
              now - globalCache.sellerStatus[userId].timestamp < CACHE_EXPIRY.sellerStatus) {
            if (isMounted) {
              setHasStripeAccount(globalCache.sellerStatus[userId].hasStripeAccount);
              setIsLoading(false);
            }
            return;
          }
        }
        
        // Check one more time after the wait
        if (globalCache.sellerStatus[userId] && 
            now - globalCache.sellerStatus[userId].timestamp < CACHE_EXPIRY.sellerStatus) {
          if (isMounted) {
            setHasStripeAccount(globalCache.sellerStatus[userId].hasStripeAccount);
            setIsLoading(false);
          }
          return;
        }
        
        // If still no data, proceed with fetch
        if (isMounted) {
          fetchSellerStatus();
        }
      };
      
      waitForUserFetch();
      return;
    }
    
    // Fetch seller status
    const fetchSellerStatus = async () => {
      try {
        const { db } = getFirebaseServices();
        if (!db) throw new Error('Firebase DB not initialized');
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          const hasAccount = !!(
            data.stripeConnectAccountId && 
            data.stripeConnectStatus === 'active'
          );
          
          // Update cache
          globalCache.sellerStatus[userId] = {
            hasStripeAccount: hasAccount,
            timestamp: now
          };
          
          // Also update user cache if we have it
          if (globalCache.users[userId]) {
            globalCache.users[userId].data.hasStripeAccount = hasAccount;
          }
          
          persistCache();
          
          if (isMounted) {
            setHasStripeAccount(hasAccount);
          }
        } else {
          // User not found
          const hasAccount = false;
          
          // Cache with shorter expiration
          globalCache.sellerStatus[userId] = {
            hasStripeAccount: hasAccount,
            timestamp: now - (CACHE_EXPIRY.sellerStatus / 2)
          };
          
          persistCache();
          
          if (isMounted) {
            setHasStripeAccount(hasAccount);
          }
        }
      } catch (error) {
        console.error('[FirestoreOptimizer] Error fetching seller status:', error);
        
        if (isMounted) {
          setHasStripeAccount(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchSellerStatus();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [userIdKey]);
  
  return { hasStripeAccount, isLoading };
};