import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from './useFavorites';

export function useListings(userId?: string) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { favorites } = useFavorites();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (userId === 'favorites') {
          setListings(favorites);
          setIsLoading(false);
          return;
        }

        const listingsRef = collection(db, 'listings');
        let q = query(listingsRef, orderBy('createdAt', 'desc'));
        
        if (userId) {
          q = query(listingsRef, 
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
          );
        }
        
        const querySnapshot = await getDocs(q);
        const fetchedListings = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            price: Number(data.price) || 0,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            isGraded: Boolean(data.isGraded),
            gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
            status: data.status || 'active'
          } as Listing;
        });
        
        setListings(fetchedListings);
      } catch (err: any) {
        console.error('Error fetching listings:', err);
        setError(err.message || 'Error fetching listings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [userId, favorites]);

  return { listings, isLoading, error };
}