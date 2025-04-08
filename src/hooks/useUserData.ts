import { useState, useEffect, useRef } from 'react';
import { getDoc, doc, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { getDatabase, ref, get } from 'firebase/database';
import { db, getFirebaseServices } from '@/lib/firebase';

// Global cache to persist across renders and components
const userCache: Record<string, {
  data: any;
  timestamp: number;
}> = {};

// Try to load initial cache from sessionStorage
try {
  const storedCache = sessionStorage.getItem('userDataCache');
  if (storedCache) {
    const parsedCache = JSON.parse(storedCache);
    Object.keys(parsedCache).forEach(key => {
      userCache[key] = parsedCache[key];
    });
    console.log(`[useUserData] Loaded ${Object.keys(parsedCache).length} cached user profiles from sessionStorage`);
  }
} catch (e) {
  // Ignore sessionStorage errors
}

const CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 10; // Number of users to fetch at once

// Function to save cache to sessionStorage
const persistCache = () => {
  try {
    sessionStorage.setItem('userDataCache', JSON.stringify(userCache));
  } catch (e) {
    // Ignore sessionStorage errors
  }
};

// Throttled version of persistCache to avoid too many writes
let persistTimeout: NodeJS.Timeout | null = null;
const throttledPersistCache = () => {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
  }
  persistTimeout = setTimeout(() => {
    persistCache();
    persistTimeout = null;
  }, 2000);
};

// Function to prefetch user data for multiple users at once
export const prefetchUserData = async (userIds: string[]) => {
  if (!userIds || !userIds.length) return;
  
  // Filter out userIds that are already in cache and not expired
  const uncachedUserIds = userIds.filter(id => 
    !userCache[id] || Date.now() - userCache[id].timestamp >= CACHE_EXPIRATION
  );
  
  if (!uncachedUserIds.length) return;
  
  console.log(`[prefetchUserData] Prefetching data for ${uncachedUserIds.length} users`);
  
  try {
    // Process in batches to avoid large queries
    for (let i = 0; i < uncachedUserIds.length; i += BATCH_SIZE) {
      const batchIds = uncachedUserIds.slice(i, i + BATCH_SIZE);
      
      // Try to get users from Firestore first
      try {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batchIds),
          limit(BATCH_SIZE)
        );
        
        const querySnapshot = await getDocs(usersQuery);
        const fetchedIds = new Set();
        
        querySnapshot.forEach(doc => {
          if (doc.exists()) {
            const data = doc.data();
            const userData = {
              username: data.displayName || data.username || 'Unknown User',
              avatarUrl: data.avatarUrl || data.photoURL || null
            };
            
            // Update cache
            userCache[doc.id] = {
              data: userData,
              timestamp: Date.now()
            };
            
            fetchedIds.add(doc.id);
          }
        });
        
        // For any users not found in Firestore, try Realtime Database
        const notFoundIds = batchIds.filter(id => !fetchedIds.has(id));
        
        if (notFoundIds.length > 0 && getFirebaseServices().database) {
          const database = getFirebaseServices().database;
          
          await Promise.allSettled(
            notFoundIds.map(async (userId) => {
              const userProfilePaths = [
                `userProfiles/${userId}`,
                `users/${userId}`
              ];
              
              for (const path of userProfilePaths) {
                try {
                  const userRef = ref(database!, path);
                  const snapshot = await get(userRef);
                  
                  if (snapshot.exists()) {
                    const data = snapshot.val();
                    if (data.displayName) {
                      const userData = {
                        username: data.displayName,
                        avatarUrl: data.avatarUrl || null
                      };
                      
                      // Update cache
                      userCache[userId] = {
                        data: userData,
                        timestamp: Date.now()
                      };
                      
                      break; // Found user data, no need to check other paths
                    }
                  }
                } catch (e) {
                  // Continue to next path
                }
              }
            })
          );
        }
        
        // Persist updated cache to sessionStorage
        throttledPersistCache();
      } catch (batchError) {
        console.error(`[prefetchUserData] Error fetching batch of users:`, batchError);
        
        // If batch query fails, fall back to individual queries
        await Promise.allSettled(
          batchIds.map(async (userId) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                const data = userDoc.data();
                const userData = {
                  username: data.displayName || data.username || 'Unknown User',
                  avatarUrl: data.avatarUrl || data.photoURL || null
                };
                
                // Update cache
                userCache[userId] = {
                  data: userData,
                  timestamp: Date.now()
                };
              } else if (getFirebaseServices().database) {
                // Try Realtime Database as fallback
                const database = getFirebaseServices().database;
                const userProfilePaths = [
                  `userProfiles/${userId}`,
                  `users/${userId}`
                ];
                
                for (const path of userProfilePaths) {
                  try {
                    const userRef = ref(database!, path);
                    const snapshot = await get(userRef);
                    
                    if (snapshot.exists()) {
                      const data = snapshot.val();
                      if (data.displayName) {
                        const userData = {
                          username: data.displayName,
                          avatarUrl: data.avatarUrl || null
                        };
                        
                        // Update cache
                        userCache[userId] = {
                          data: userData,
                          timestamp: Date.now()
                        };
                        
                        break; // Found user data, no need to check other paths
                      }
                    }
                  } catch (e) {
                    // Continue to next path
                  }
                }
              }
            } catch (err) {
              console.error(`[prefetchUserData] Error fetching individual user ${userId}:`, err);
            }
          })
        );
        
        // Persist updated cache to sessionStorage
        throttledPersistCache();
      }
    }
  } catch (err) {
    console.error('[prefetchUserData] Error prefetching user data:', err);
  }
};

export function useUserData(userId: string, initialData?: any) {
  const [userData, setUserData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData && !userCache[userId]);
  const [error, setError] = useState<Error | null>(null);
  const fetchAttempted = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Reset state when userId changes
    if (!fetchAttempted.current) {
      setLoading(!initialData && !userCache[userId]);
      setError(null);
      
      // Check cache first
      if (userCache[userId] && Date.now() - userCache[userId].timestamp < CACHE_EXPIRATION) {
        if (isMounted.current) {
          setUserData(userCache[userId].data);
          setLoading(false);
        }
        return;
      }

      const fetchUserData = async () => {
        fetchAttempted.current = true;
        
        try {
          // Try Realtime Database first
          const { database } = getFirebaseServices();
          if (database) {
            const userProfilePaths = [
              `userProfiles/${userId}`,
              `users/${userId}`
            ];
            
            for (const path of userProfilePaths) {
              try {
                const userRef = ref(database, path);
                const snapshot = await get(userRef);
                
                if (snapshot.exists()) {
                  const data = snapshot.val();
                  if (data.displayName) {
                    const userData = {
                      username: data.displayName,
                      avatarUrl: data.avatarUrl || null
                    };
                    
                    // Update cache
                    userCache[userId] = {
                      data: userData,
                      timestamp: Date.now()
                    };
                    
                    // Persist to sessionStorage
                    throttledPersistCache();
                    
                    if (isMounted.current) {
                      setUserData(userData);
                      setLoading(false);
                    }
                    return;
                  }
                }
              } catch (e) {
                // Continue to next path
              }
            }
          }
          
          // If not found in RTDB, try Firestore
          const userDoc = await getDoc(doc(db, 'users', userId));
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userData = {
              username: data.displayName || data.username || initialData?.username || "Unknown User",
              avatarUrl: data.avatarUrl || data.photoURL || null
            };
            
            // Update cache
            userCache[userId] = {
              data: userData,
              timestamp: Date.now()
            };
            
            // Persist to sessionStorage
            throttledPersistCache();
            
            if (isMounted.current) {
              setUserData(userData);
            }
          } else {
            // If we reach here and still have initialData, use that
            if (initialData && isMounted.current) {
              setUserData(initialData);
              
              // Cache the initialData too if it has a username
              if (initialData.username && initialData.username !== 'Unknown User') {
                userCache[userId] = {
                  data: initialData,
                  timestamp: Date.now()
                };
                throttledPersistCache();
              }
            }
          }
        } catch (err: any) {
          if (isMounted.current) {
            setError(err);
            // Fall back to initial data if available
            if (initialData) {
              setUserData(initialData);
            }
          }
        } finally {
          if (isMounted.current) {
            setLoading(false);
          }
        }
      };

      fetchUserData();
    }
    
    return () => {
      fetchAttempted.current = false;
    };
  }, [userId, initialData]);

  return { userData, loading, error };
}