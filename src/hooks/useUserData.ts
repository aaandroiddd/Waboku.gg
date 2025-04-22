import { useState, useEffect, useRef } from 'react';
import { getDoc, doc, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { getDatabase, ref, get } from 'firebase/database';
import { db, getFirebaseServices } from '@/lib/firebase';

// Global flag to track if we're in messages page
let isInMessagesPage = false;

// Set this flag when in messages page, but we'll still prioritize Firestore for user data
export const setMessagesPageMode = (value: boolean) => {
  isInMessagesPage = value;
  console.log(`[useUserData] Messages page mode ${value ? 'enabled' : 'disabled'} (Firestore prioritized for user data)`);
};

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
  console.warn("[useUserData] Could not load from sessionStorage:", e);
}

const CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 10; // Number of users to fetch at once

// Function to save cache to sessionStorage
const persistCache = () => {
  try {
    sessionStorage.setItem('userDataCache', JSON.stringify(userCache));
  } catch (e) {
    // Ignore sessionStorage errors
    console.warn("[useUserData] Could not persist to sessionStorage:", e);
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
      const fetchedIds = new Set<string>();
      
      // Always try Firestore first for user data, regardless of page mode
      // This ensures Firestore is prioritized for user profiles
      const notFoundIds = batchIds.filter(id => !fetchedIds.has(id));
      
      if (notFoundIds.length > 0) {
        try {
          const usersQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', notFoundIds),
            limit(BATCH_SIZE)
          );
          
          const querySnapshot = await getDocs(usersQuery);
          
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
        } catch (firestoreError) {
          console.error('[prefetchUserData] Error fetching from Firestore:', firestoreError);
        }
      }
      
      // For any users not found in either database, try the other database based on the mode
      const stillNotFoundIds = batchIds.filter(id => !fetchedIds.has(id));
      
      if (stillNotFoundIds.length > 0) {
        if (isInMessagesPage) {
          // In messages page, we already tried RTDB, now try Firestore
          // Code is already implemented above, so no need to duplicate
        } else {
          // Not in messages page, we tried Firestore first, now try RTDB
          if (getFirebaseServices().database) {
            const database = getFirebaseServices().database;
            
            await Promise.allSettled(
              stillNotFoundIds.map(async (userId) => {
                const userProfilePaths = [
                  `userProfiles/${userId}`,
                  `users/${userId}`,
                  `usernames/${userId}`
                ];
                
                for (const path of userProfilePaths) {
                  try {
                    const userRef = ref(database!, path);
                    const snapshot = await get(userRef);
                    
                    if (snapshot.exists()) {
                      const data = snapshot.val();
                      if (data.displayName || data.username) {
                        const userData = {
                          username: data.displayName || data.username,
                          avatarUrl: data.avatarUrl || data.photoURL || null
                        };
                        
                        // Update cache
                        userCache[userId] = {
                          data: userData,
                          timestamp: Date.now()
                        };
                        
                        fetchedIds.add(userId);
                        break; // Found user data, no need to check other paths
                      }
                    }
                  } catch (e) {
                    // Continue to next path
                    console.warn(`[prefetchUserData] Error accessing path ${path} for user ${userId}:`, e);
                  }
                }
              })
            );
          }
        }
      }
      
      // Persist updated cache to sessionStorage
      throttledPersistCache();
    }
  } catch (err) {
    console.error('[prefetchUserData] Error prefetching user data:', err);
  }
};

export function useUserData(userId: string, initialData?: any) {
  const [userData, setUserData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData && !userCache[userId]);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef<boolean>(true);
  const fetchAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Reset state when userId changes
    setLoading(!initialData && !userCache[userId]);
    setError(null);
    fetchAttemptedRef.current = false;
    
    // Check cache first
    if (userCache[userId] && Date.now() - userCache[userId].timestamp < CACHE_EXPIRATION) {
      if (isMounted.current) {
        setUserData(userCache[userId].data);
        setLoading(false);
      }
      return;
    }

    const fetchUserData = async () => {
      // Mark that we've attempted to fetch data for this userId
      fetchAttemptedRef.current = true;
      
      try {
        let foundUser = false;
        let userData = null;
        
        // Always try Firestore first for user data, regardless of page mode
        // This ensures consistent user data from Firestore
        userData = await fetchFromFirestore(userId);
        if (userData) {
          foundUser = true;
        } else {
          // Fall back to Realtime Database only if not found in Firestore
          userData = await fetchFromRealtimeDatabase(userId);
          if (userData) {
            foundUser = true;
          }
        }
        
        // If we found user data in either database
        if (foundUser && userData) {
          if (isMounted.current) {
            setUserData(userData);
            setLoading(false);
          }
          return;
        }
        
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
        } else if (isMounted.current) {
          // Last resort fallback - but with a clear indication it's a fallback
          console.warn(`[useUserData] User ${userId} not found in either database`);
          const fallbackData = {
            username: `User ${userId.substring(0, 6)}...`,
            avatarUrl: null
          };
          setUserData(fallbackData);
          
          // Cache this fallback with a shorter expiration
          userCache[userId] = {
            data: fallbackData,
            timestamp: Date.now() - (CACHE_EXPIRATION / 2) // Expire sooner
          };
        }
      } catch (err: any) {
        console.error(`[useUserData] Error fetching user data for ${userId}:`, err);
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
  }, [userId, initialData]);

  // Helper function to fetch from Realtime Database
  const fetchFromRealtimeDatabase = async (userId: string): Promise<any | null> => {
    const { database } = getFirebaseServices();
    if (!database) return null;
    
    console.log(`[useUserData] Trying to fetch user ${userId} from Realtime Database`);
    
    // Expanded list of potential paths to check for user data
    const userProfilePaths = [
      `userProfiles/${userId}`,
      `users/${userId}`,
      `usernames/${userId}`,
      `profiles/${userId}`,
      `user_profiles/${userId}`,
      `userData/${userId}`
    ];
    
    for (const path of userProfilePaths) {
      try {
        const userRef = ref(database, path);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log(`[useUserData] Found user data for ${userId} at path ${path}:`, data);
          
          // Check for displayName or username in various formats
          if (data.displayName || data.username || data.name || data.userName || data.display_name) {
            const userData = {
              username: data.displayName || data.username || data.name || data.userName || data.display_name,
              avatarUrl: data.avatarUrl || data.photoURL || data.avatar || data.avatarURL || data.photo || null
            };
            
            console.log(`[useUserData] Successfully extracted username: ${userData.username}`);
            
            // Update cache
            userCache[userId] = {
              data: userData,
              timestamp: Date.now()
            };
            
            // Persist to sessionStorage
            throttledPersistCache();
            
            return userData;
          } else {
            // If we found the user but they don't have a username field,
            // log the data so we can see what fields are available
            console.log(`[useUserData] User ${userId} found at ${path} but has no username field. Available fields:`, Object.keys(data));
          }
        }
      } catch (e) {
        console.warn(`[useUserData] Error accessing RTDB path ${path} for user ${userId}:`, e);
        // Continue to next path
      }
    }
    
    return null;
  };

  // Helper function to fetch from Firestore
  const fetchFromFirestore = async (userId: string): Promise<any | null> => {
    try {
      console.log(`[useUserData] Trying to fetch user ${userId} from Firestore`);
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log(`[useUserData] Found user data for ${userId} in Firestore:`, data);
        
        // Check for any field that might contain a username
        // If displayName doesn't exist, try to use email or other fields
        let username;
        
        if (data.displayName) {
          username = data.displayName;
        } else if (data.email) {
          // If no display name but email exists, use the part before @
          const emailMatch = data.email.match(/^([^@]+)@/);
          if (emailMatch && emailMatch[1]) {
            username = emailMatch[1]; // Use the part before @ as username
          }
        }
        
        // If we still don't have a username, use any other identifier
        if (!username) {
          username = data.name || data.userName || data.username || 
                    data.email || `User ${userId.substring(0, 6)}...`;
        }
        
        const userData = {
          username: username,
          avatarUrl: data.avatarUrl || data.photoURL || data.avatar || data.avatarURL || data.photo || null,
          email: data.email || null // Store email for reference
        };
        
        console.log(`[useUserData] Successfully extracted username: ${userData.username}`);
        
        // Update cache
        userCache[userId] = {
          data: userData,
          timestamp: Date.now()
        };
        
        // Persist to sessionStorage
        throttledPersistCache();
        
        return userData;
      } else {
        console.log(`[useUserData] No user document found for ${userId} in Firestore`);
      }
    } catch (firestoreError) {
      console.error('[useUserData] Error fetching from Firestore:', firestoreError);
    }
    
    return null;
  };

  return { userData, loading, error };
}
