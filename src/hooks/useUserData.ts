import { useState, useEffect, useRef } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

// Global cache for user data with longer expiration (10 minutes)
const userDataCache: Record<string, {
  data: { username: string; avatarUrl?: string };
  timestamp: number;
}> = {};

// Cache expiration time (10 minutes)
const CACHE_EXPIRATION = 10 * 60 * 1000;

// Maximum number of retries
const MAX_RETRIES = 3;

export function useUserData(userId: string | undefined) {
  const [userData, setUserData] = useState<{
    username: string;
    avatarUrl?: string;
  } | null>(userId && userDataCache[userId] ? userDataCache[userId].data : null);
  
  const [loading, setLoading] = useState(!userData);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Reset retry count when userId changes
    retryCountRef.current = 0;

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
      return;
    }

    // Function to fetch user data with retry logic
    const fetchUserData = async (retry = 0) => {
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
          
          if (isMountedRef.current) {
            setUserData(userData);
            setLoading(false);
          }
          return true;
        } else if (retry < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = Math.pow(2, retry) * 500; // 500ms, 1s, 2s, etc.
          console.log(`User data not found for ${userId}, retrying in ${delay}ms (attempt ${retry + 1}/${MAX_RETRIES})`);
          
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchUserData(retry + 1);
            }
          }, delay);
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
          
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchUserData(retry + 1);
            }
          }, delay);
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
          }
          return true;
        }
      }
    };

    // First try to get the data immediately
    fetchUserData();

    // Then set up real-time listener for updates
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
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchUserData(retryCountRef.current);
            }
          }, 1000 * retryCountRef.current);
        } else {
          // Max retries reached, set fallback data
          if (isMountedRef.current) {
            setUserData({
              username: 'Unknown User',
              avatarUrl: undefined
            });
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error('Error in user data snapshot:', error);
        if (isMountedRef.current) {
          setError(error.message);
          setLoading(false);
          
          // Set fallback data
          setUserData({
            username: 'Unknown User',
            avatarUrl: undefined
          });
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return { userData, loading, error };
}