import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';

export function useListings(userId?: string) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let q = collection(db, 'listings');
        if (userId) {
          q = query(q, where('userId', '==', userId));
        }
        
        const querySnapshot = await getDocs(q);
        const fetchedListings = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Listing[];
        
        setListings(fetchedListings);
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching listings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [userId]);

  return { listings, isLoading, error };
}