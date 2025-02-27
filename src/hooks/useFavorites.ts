import { db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  
  // Add a state to track if the hook has been initialized
  const [initialized, setInitialized] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const favoritesRef = collection(db, 'users', user.uid, 'favorites');
      const favoritesSnapshot = await getDocs(favoritesRef);
      
      const favoriteIdsSet = new Set<string>();
      const favoritePromises = favoritesSnapshot.docs.map(async (favoriteDoc) => {
        const listingId = favoriteDoc.id;
        favoriteIdsSet.add(listingId);
        
        try {
          // Get the listing document directly using its ID
          const listingDoc = await getDoc(doc(db, 'listings', listingId));
          
          if (listingDoc.exists()) {
            const data = listingDoc.data();
            return {
              id: listingDoc.id,
              ...data,
              createdAt: data.createdAt?.toDate(),
              archivedAt: data.archivedAt?.toDate()
            } as Listing;
          }
        } catch (err) {
          console.error(`Error fetching listing ${listingId}:`, err);
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
  }, [user]);

  const toggleFavorite = async (listing: Listing, event?: React.MouseEvent) => {
    // Prevent event propagation if event is provided
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!user) {
      toast.error('Please sign in to save favorites');
      return;
    }

    // Prevent duplicate operations on the same listing
    if (pendingOperations.has(listing.id)) {
      console.log('Operation already in progress for listing:', listing.id);
      return;
    }

    const favoriteRef = doc(db, 'users', user.uid, 'favorites', listing.id);
    const isFav = favoriteIds.has(listing.id);

    try {
      // Mark operation as pending
      setPendingOperations(prev => new Set([...prev, listing.id]));
      console.log(`${isFav ? 'Removing from' : 'Adding to'} favorites:`, listing.id);
      
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
          listingId: listing.id,  // Store the listing ID directly
          createdAt: new Date()
        });
      }
      
      // Show success toast
      toast.success(isFav ? 'Removed from favorites' : 'Added to favorites');
      
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
      toast.error('Failed to update favorites');
      
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
    } finally {
      // Remove from pending operations
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(listing.id);
        return newSet;
      });
    }
  };

  const isFavorite = useCallback((listingId: string) => {
    return favoriteIds.has(listingId);
  }, [favoriteIds]);
  
  const isPending = useCallback((listingId: string) => {
    return pendingOperations.has(listingId);
  }, [pendingOperations]);

  useEffect(() => {
    fetchFavorites().then(() => {
      setInitialized(true);
    });
  }, [user, fetchFavorites]);

  return {
    favorites,
    isLoading,
    error,
    toggleFavorite,
    isFavorite,
    isPending,
    refresh: fetchFavorites,
    initialized
  };
}