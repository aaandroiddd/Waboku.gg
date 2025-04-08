import { useState, useEffect, useRef } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { getDatabase, ref, get } from 'firebase/database';
import { db, getFirebaseServices } from '@/lib/firebase';

// Global cache to persist across renders and components
const userCache: Record<string, {
  data: any;
  timestamp: number;
}> = {};

const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

export function useUserData(userId: string, initialData?: any) {
  const [userData, setUserData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<Error | null>(null);
  const fetchAttempted = useRef<boolean>(false);

  useEffect(() => {
    if (!userId) return;

    // Reset state when userId changes
    if (!fetchAttempted.current) {
      setLoading(true);
      setError(null);
      
      // Check cache first
      if (userCache[userId] && Date.now() - userCache[userId].timestamp < CACHE_EXPIRATION) {
        setUserData(userCache[userId].data);
        setLoading(false);
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
                    
                    setUserData(userData);
                    setLoading(false);
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
            
            setUserData(userData);
          } else {
            // If we reach here and still have initialData, use that
            if (initialData) {
              setUserData(initialData);
            }
          }
        } catch (err: any) {
          setError(err);
          // Fall back to initial data if available
          if (initialData) {
            setUserData(initialData);
          }
        } finally {
          setLoading(false);
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