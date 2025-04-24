import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, getDocs, query, collection, where, limit, documentId } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

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

// Batch user data fetching
export const batchFetchUserData = async (userIds: string[]): Promise<void> => {
  if (!userIds.length) return;
  
  // Filter out users that are already in cache and not expired
  const now = Date.now();
  const uncachedUserIds = userIds.filter(id => 
    !globalCache.users[id] || now - globalCache.users[id].timestamp >= CACHE_EXPIRY.users
  );
  
  if (!uncachedUserIds.length) return;
  
  console.log(`[FirestoreOptimizer] Batch fetching data for ${uncachedUserIds.length} users`);
  
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
  }
};

// Hook to get user data with optimized fetching
export const useOptimizedUserData = (userId: string) => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
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
          
          setUserData(userData);
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
          
          setUserData(fallbackData);
        }
      } catch (error) {
        console.error('[FirestoreOptimizer] Error fetching user data:', error);
        
        // Fallback data on error
        const fallbackData = {
          username: `User ${userId.substring(0, 6)}...`,
          avatarUrl: null,
          hasStripeAccount: false
        };
        
        setUserData(fallbackData);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [userId]);
  
  return { userData, loading };
};

// Hook to get seller status with optimized fetching
export const useOptimizedSellerStatus = (userId: string) => {
  const [hasStripeAccount, setHasStripeAccount] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
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
          
          // Also update user data if we have it
          if (globalCache.users[userId]) {
            globalCache.users[userId].data.hasStripeAccount = hasAccount;
          }
          
          persistCache();
          
          setHasStripeAccount(hasAccount);
        } else {
          // User not found
          globalCache.sellerStatus[userId] = {
            hasStripeAccount: false,
            timestamp: now - (CACHE_EXPIRY.sellerStatus / 2)
          };
          
          persistCache();
          
          setHasStripeAccount(false);
        }
      } catch (error) {
        console.error('[FirestoreOptimizer] Error fetching seller status:', error);
        setHasStripeAccount(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSellerStatus();
  }, [userId]);
  
  return { hasStripeAccount, isLoading };
};

// Function to prefetch similar listings
export const prefetchSimilarListings = async (listingId: string, game: string, maxListings: number = 6) => {
  // Check cache first
  const now = Date.now();
  if (globalCache.similarListings[listingId] && now - globalCache.similarListings[listingId].timestamp < CACHE_EXPIRY.similarListings) {
    console.log(`[FirestoreOptimizer] Using cached similar listings for ${listingId}`);
    return globalCache.similarListings[listingId].data;
  }
  
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
    
    // Cache the results
    globalCache.similarListings[listingId] = {
      data: sortedResults,
      timestamp: now
    };
    
    persistCache();
    
    // Also prefetch user data for these listings
    const userIds = sortedResults.map(listing => listing.userId).filter(Boolean);
    if (userIds.length) {
      batchFetchUserData(userIds);
    }
    
    return sortedResults;
  } catch (error) {
    console.error('[FirestoreOptimizer] Error fetching similar listings:', error);
    return [];
  }
};

// Hook to get similar listings with optimized fetching
export const useOptimizedSimilarListings = (currentListing: any, maxListings: number = 6) => {
  const [similarListings, setSimilarListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (!currentListing?.id || !currentListing?.game) {
      setIsLoading(false);
      return;
    }
    
    // Check cache first
    const now = Date.now();
    if (
      globalCache.similarListings[currentListing.id] && 
      now - globalCache.similarListings[currentListing.id].timestamp < CACHE_EXPIRY.similarListings
    ) {
      setSimilarListings(globalCache.similarListings[currentListing.id].data);
      setIsLoading(false);
      
      // Prefetch user data for these listings
      const userIds = globalCache.similarListings[currentListing.id].data
        .map(listing => listing.userId)
        .filter(Boolean);
      
      if (userIds.length) {
        batchFetchUserData(userIds);
      }
      
      return;
    }
    
    // Fetch similar listings
    const fetchSimilarListings = async () => {
      try {
        const listings = await prefetchSimilarListings(currentListing.id, currentListing.game, maxListings);
        setSimilarListings(listings);
      } catch (error) {
        console.error('[FirestoreOptimizer] Error in useOptimizedSimilarListings:', error);
        setSimilarListings([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSimilarListings();
  }, [currentListing?.id, currentListing?.game, maxListings]);
  
  return { similarListings, isLoading };
};

// Function to clear cache
export const clearFirestoreCache = () => {
  Object.keys(globalCache.users).forEach(key => delete globalCache.users[key]);
  Object.keys(globalCache.sellerStatus).forEach(key => delete globalCache.sellerStatus[key]);
  Object.keys(globalCache.listings).forEach(key => delete globalCache.listings[key]);
  Object.keys(globalCache.similarListings).forEach(key => delete globalCache.similarListings[key]);
  
  try {
    localStorage.removeItem('firestoreCache');
    console.log('[FirestoreOptimizer] Cache cleared');
  } catch (e) {
    console.warn('[FirestoreOptimizer] Error clearing cache from localStorage:', e);
  }
};