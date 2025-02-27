import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const favoritesRef = collection(db, 'users', user.uid, 'favorites');
      const favoritesSnapshot = await getDocs(favoritesRef);
      
      const favoriteIdsSet = new Set<string>();
      const favoritePromises = favoritesSnapshot.docs.map(async (doc) => {
        const listingId = doc.id;
        favoriteIdsSet.add(listingId);
        
        const listingDoc = await getDoc(doc.data().listingRef);
        if (listingDoc.exists()) {
          const data = listingDoc.data();
          return {
            id: listingDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            archivedAt: data.archivedAt?.toDate()
          } as Listing;
        }
        return null;
      });

      const resolvedFavorites = (await Promise.all(favoritePromises)).filter((f): f is Listing => f !== null);
      setFavorites(resolvedFavorites);
      setFavoriteIds(favoriteIdsSet);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch favorites');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = async (listing: Listing, event?: React.MouseEvent) => {
    // Prevent event propagation if event is provided
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!user) return;

    // Prevent duplicate operations on the same listing
    if (pendingOperations.has(listing.id)) {
      return;
    }

    const favoriteRef = doc(db, 'users', user.uid, 'favorites', listing.id);
    const listingRef = doc(db, 'listings', listing.id);
    const isFav = favoriteIds.has(listing.id);

    try {
      // Optimistically update UI
      setPendingOperations(prev => new Set([...prev, listing.id]));
      
      if (isFav) {
        // Optimistically remove from favorites
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(listing.id);
          return newSet;
        });
        setFavorites(prev => prev.filter(f => f.id !== listing.id));
        
        // Then perform the actual operation
        await deleteDoc(favoriteRef);
      } else {
        // Optimistically add to favorites
        setFavoriteIds(prev => new Set([...prev, listing.id]));
        setFavorites(prev => [...prev, listing]);
        
        // Then perform the actual operation
        await setDoc(favoriteRef, {
          listingRef,
          createdAt: new Date()
        });
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
      
      // Revert optimistic updates on error
      if (isFav) {
        setFavoriteIds(prev => new Set([...prev, listing.id]));
        setFavorites(prev => [...prev, listing]);
      } else {
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(listing.id);
          return newSet;
        });
        setFavorites(prev => prev.filter(f => f.id !== listing.id));
      }
      
      // Re-fetch favorites to ensure UI is in sync
      await fetchFavorites();
    } finally {
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(listing.id);
        return newSet;
      });
    }
  };

  const isFavorite = (listingId: string) => favoriteIds.has(listingId);
  
  const isPending = (listingId: string) => pendingOperations.has(listingId);

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  return {
    favorites,
    isLoading,
    error,
    toggleFavorite,
    isFavorite,
    isPending,
    refresh: fetchFavorites
  };
}