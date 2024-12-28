import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from './useFavorites';

interface UseListingsProps {
  userId?: string;
  searchQuery?: string;
}

export function useListings({ userId, searchQuery }: UseListingsProps = {}) {
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
          let filteredFavorites = favorites;
          if (searchQuery) {
            filteredFavorites = favorites.filter(listing => 
              listing.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              listing.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          setListings(filteredFavorites);
          setIsLoading(false);
          return;
        }

        const listingsRef = collection(db, 'listings');
        const constraints: QueryConstraint[] = [];

        // Add user filter if specified
        if (userId) {
          constraints.push(where('userId', '==', userId));
        }

        // Add title search if specified
        if (searchQuery) {
          // Firebase doesn't support case-insensitive search directly
          // We'll fetch all results and filter in memory for now
          // In a production environment, you might want to use Algolia or a similar service
          constraints.push(where('title', '>=', searchQuery.toLowerCase()));
          constraints.push(where('title', '<=', searchQuery.toLowerCase() + '\uf8ff'));
        }

        // Always order by creation date
        constraints.push(orderBy('createdAt', 'desc'));
        
        const q = query(listingsRef, ...constraints);
        const querySnapshot = await getDocs(q);
        
        let fetchedListings = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
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
          } as Listing;
        });

        // If there's a search query, filter results in memory to handle case-insensitive search
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          fetchedListings = fetchedListings.filter(listing => 
            listing.title?.toLowerCase().includes(searchLower) ||
            listing.description?.toLowerCase().includes(searchLower)
          );
        }
        
        setListings(fetchedListings);
      } catch (err: any) {
        console.error('Error fetching listings:', err);
        setError(err.message || 'Error fetching listings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [userId, searchQuery, favorites]);

  return { listings, isLoading, error };
}