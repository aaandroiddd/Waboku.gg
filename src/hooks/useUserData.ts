import { useState, useEffect, useRef } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, getDocs, query, collection, where, limit } from 'firebase/firestore';

// Global cache for user data with longer expiration (15 minutes)
const userDataCache: Record<string, {
  data: { username: string; avatarUrl?: string };
  timestamp: number;
}> = {};

// Cache expiration time (15 minutes)
const CACHE_EXPIRATION = 15 * 60 * 1000;

// Maximum number of retries
const MAX_RETRIES = 3;

// Batch prefetch size
const BATCH_SIZE = 10;

// Prefetch user data for multiple users at once
export const prefetchUserData = async (userIds: string[]) => {
  if (!userIds.length) return;
  
  // Filter out userIds that are already in cache and not expired
  const uncachedUserIds = userIds.filter(id => 
    !userDataCache[id] || Date.now() - userDataCache[id].timestamp >= CACHE_EXPIRATION
  );
  
  if (!uncachedUserIds.length) return;
  
  console.log(`Prefetching data for ${uncachedUserIds.length} users`);
  
  try {
    const { db } = getFirebaseServices();
    if (!db) return;
    
    // Process in batches to avoid large queries
    for (let i = 0; i < uncachedUserIds.length; i += BATCH_SIZE) {
      const batchIds = uncachedUserIds.slice(i, i + BATCH_SIZE);
      
      // Create a query to get multiple users at once
      const usersQuery = query(
        collection(db, 'users'),
        where('__name__', 'in', batchIds),
        limit(BATCH_SIZE)
      );
      
      try {
        const querySnapshot = await getDocs(usersQuery);
        
        querySnapshot.forEach(doc => {
          if (doc.exists()) {
            const data = doc.data();
            const userData = {
              username: data.displayName || data.username || 'Unknown User',
              avatarUrl: data.avatarUrl || data.photoURL
            };
            
            // Update cache
            userDataCache[doc.id] = {
              data: userData,
              timestamp: Date.now()
            };
          }
        });
      } catch (batchError) {
        console.error(`Error fetching batch of users:`, batchError);
        
        // If batch query fails, fall back to individual queries
        await Promise.allSettled(
          batchIds.map(async (userId) => {
            try {
              const docSnap = await getDoc(doc(db, 'users', userId));
              if (docSnap.exists()) {
                const data = docSnap.data();
                const userData = {
                  username: data.displayName || data.username || 'Unknown User',
                  avatarUrl: data.avatarUrl || data.photoURL
                };
                
                // Update cache
                userDataCache[userId] = {
                  data: userData,
                  timestamp: Date.now()
                };
              }
            } catch (err) {
              console.error(`Error fetching individual user ${userId}:`, err);
            }
          })
        );
      }
    }
  } catch (err) {
    console.error('Error prefetching user data:', err);
  }
};

export function useUserData(userId: string | undefined) {
  const [userData, setUserData] = useState<{
    username: string;
    avatarUrl?: string;
  } | null>(userId && userDataCache[userId] ? userDataCache[userId].data : null);
  
  const [loading, setLoading] = useState(!userData);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Reset retry count when userId changes
    retryCountRef.current = 0;
    
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    
    // Unsubscribe from previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Check cache first
    if (userDataCache[userId] && Date.now() - userDataCache[userId].timestamp < CACHE_EXPIRATION) {
      setUserData(userDataCache[userId].data);
      setLoading(false);
      return;
    }

    const { db } = getFirebaseServices();
    if (!db) {
      setError('Database not initialized');
      setLoading(false);
      // Set fallback data even when database fails
      setUserData({
        username: 'Unknown User',
        avatarUrl: undefined
      });
      return;
    }

    // Function to fetch user data with retry logic
    const fetchUserData = async (retry = 0) => {
      try {
        // First try to get from cache
        if (userDataCache[userId] && Date.now() - userDataCache[userId].timestamp < CACHE_EXPIRATION) {
          if (isMountedRef.current) {
            setUserData(userDataCache[userId].data);
            setLoading(false);
          }
          return true;
        }
        
        const docSnap = await getDoc(doc(db, 'users', userId));
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const userData = {
            username: data.displayName || data.username || 'Unknown User',
            avatarUrl: data.avatarUrl || data.photoURL
          };
          
          // Update cache
          userDataCache[userId] = {
            data: userData,
            timestamp: Date.now()
          };
          
          if (isMountedRef.current) {
            setUserData(userData);
            setLoading(false);
          }
          return true;
        } else if (retry < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = Math.pow(2, retry) * 500; // 500ms, 1s, 2s, etc.
          console.log(`User data not found for ${userId}, retrying in ${delay}ms (attempt ${retry + 1}/${MAX_RETRIES})`);
          
          if (isMountedRef.current) {
            fetchTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                fetchUserData(retry + 1);
              }
            }, delay);
          }
          return false;
        } else {
          // Max retries reached, set fallback data
          const fallbackData = {
            username: 'Unknown User',
            avatarUrl: undefined
          };
          
          // Cache the fallback with shorter expiration (1 minute)
          userDataCache[userId] = {
            data: fallbackData,
            timestamp: Date.now() - (CACHE_EXPIRATION - 60000) // Will expire in 1 minute
          };
          
          if (isMountedRef.current) {
            setUserData(fallbackData);
            setLoading(false);
          }
          return true;
        }
      } catch (err) {
        console.error(`Error fetching user data for ${userId}:`, err);
        
        if (retry < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = Math.pow(2, retry) * 500;
          console.log(`Error fetching user data for ${userId}, retrying in ${delay}ms (attempt ${retry + 1}/${MAX_RETRIES})`);
          
          if (isMountedRef.current) {
            fetchTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                fetchUserData(retry + 1);
              }
            }, delay);
          }
          return false;
        } else {
          // Max retries reached, set error
          if (isMountedRef.current) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
            
            // Set fallback data
            const fallbackData = {
              username: 'Unknown User',
              avatarUrl: undefined
            };
            setUserData(fallbackData);
            
            // Cache the fallback with shorter expiration
            userDataCache[userId] = {
              data: fallbackData,
              timestamp: Date.now() - (CACHE_EXPIRATION - 60000) // Will expire in 1 minute
            };
          }
          return true;
        }
      }
    };

    // First try to get the data immediately
    fetchUserData();

    // Then set up real-time listener for updates with error handling
    try {
      const userRef = doc(db, 'users', userId);
      
      const unsubscribe = onSnapshot(
        userRef, 
        (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            const userData = {
              username: data.displayName || data.username || 'Unknown User',
              avatarUrl: data.avatarUrl || data.photoURL
            };
            
            // Update cache
            userDataCache[userId] = {
              data: userData,
              timestamp: Date.now()
            };
            
            if (isMountedRef.current) {
              setUserData(userData);
              setLoading(false);
            }
          } else if (retryCountRef.current < MAX_RETRIES) {
            // Increment retry count
            retryCountRef.current++;
            
            // Try to fetch again after a delay
            if (isMountedRef.current) {
              fetchTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  fetchUserData(retryCountRef.current);
                }
              }, 1000 * retryCountRef.current);
            }
          } else {
            // Max retries reached, set fallback data
            if (isMountedRef.current) {
              const fallbackData = {
                username: 'Unknown User',
                avatarUrl: undefined
              };
              
              setUserData(fallbackData);
              setLoading(false);
              
              // Cache the fallback with shorter expiration
              userDataCache[userId] = {
                data: fallbackData,
                timestamp: Date.now() - (CACHE_EXPIRATION - 60000) // Will expire in 1 minute
              };
            }
          }
        },
        (error) => {
          console.error('Error in user data snapshot:', error);
          if (isMountedRef.current) {
            setError(error.message);
            setLoading(false);
            
            // Set fallback data
            const fallbackData = {
              username: 'Unknown User',
              avatarUrl: undefined
            };
            setUserData(fallbackData);
            
            // Cache the fallback with shorter expiration
            userDataCache[userId] = {
              data: fallbackData,
              timestamp: Date.now() - (CACHE_EXPIRATION - 60000) // Will expire in 1 minute
            };
          }
        }
      );
      
      // Store the unsubscribe function
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.error('Error setting up snapshot listener:', err);
      // If setting up the listener fails, rely on the one-time fetch
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [userId]);

  return { userData, loading, error };
}