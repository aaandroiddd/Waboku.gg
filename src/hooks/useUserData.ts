import { useState, useEffect } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useUserData(userId: string | undefined) {
  const [userData, setUserData] = useState<{
    username: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const { db } = getFirebaseServices();
    if (!db) {
      setError('Database not initialized');
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userRef, 
      (doc) => {
        if (doc.exists()) {
          setUserData({
            username: doc.data().username || 'Unknown User',
          });
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