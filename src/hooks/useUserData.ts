import { useState, useEffect } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

// Cache for user data
const userDataCache: Record<string, {
  data: { username: string; avatarUrl?: string };
  timestamp: number;
}> = {};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

export function useUserData(userId: string | undefined) {
  const [userData, setUserData] = useState<{
    username: string;
    avatarUrl?: string;
  } | null>(userId && userDataCache[userId] ? userDataCache[userId].data : null);
  
  const [loading, setLoading] = useState(!userData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
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
      return;
    }

    // First try to get the data immediately
    const fetchInitialData = async () => {
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
          
          setUserData(userData);
        } else {
          setUserData(null);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching initial user data:', err);
        // We'll continue with the real-time listener
      }
    };

    fetchInitialData();

    // Then set up real-time listener for updates
    const userRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userRef, 
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
          
          setUserData(userData);
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching user data:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { userData, loading, error };
}