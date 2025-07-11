// useFavorites.ts
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/router';

export interface FavoriteListing extends Listing {
}

export function useFavorites() {
  const { user } = useAuth();
  const { saveRedirectState } = useAuthRedirect();
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
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
      
      const { db } = getFirebaseServices();
      if (!db) {
        throw new Error('Database not initialized');
      }
      
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
            } as FavoriteListing;
          }
        } catch (err) {
          console.error(`Error fetching listing ${listingId}:`, err);
        }
        return null;
      });

      // Filter out null values and archived listings
      const resolvedFavorites = (await Promise.all(favoritePromises))
        .filter((f): f is FavoriteListing => f !== null)
        .filter(listing => listing.status !== 'archived');
      
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
    
    // Debug logging
    try {
      await fetch('/api/debug/test-save-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'toggleFavorite_called',
          data: {
            hasUser: !!user,
            listingId: listing.id,
            listingTitle: listing.title
          }
        })
      });
    } catch (debugError) {
      console.error('Debug logging failed:', debugError);
    }
    
    if (!user) {
      console.log('toggleFavorite: No user, saving redirect state');
      toast.error('Please sign in to save favorites');
      // Save the current action before redirecting
      saveRedirectState('toggle_favorite', { listingId: listing.id });
      router.push('/auth/sign-in');
      return;
    }

    // Prevent duplicate operations on the same listing
    if (pendingOperations.has(listing.id)) {
      console.log('Operation already in progress for listing:', listing.id);
      return;
    }

    const isFav = favoriteIds.has(listing.id);

    try {
      // Mark operation as pending
      setPendingOperations(prev => new Set([...prev, listing.id]));
      
      const { db } = getFirebaseServices();
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      if (isFav) {
        // If it's already a favorite, remove it
        console.log('Removing from favorites:', listing.id);
        
        // Optimistically remove from favorites
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(listing.id);
          return newSet;
        });
        setFavorites(prev => prev.filter(f => f.id !== listing.id));
        
        // Perform the actual operation
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', listing.id);
        await deleteDoc(favoriteRef);
        
        // Show success toast
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        console.log('Adding to favorites:', listing.id);
        
        // Optimistically add to favorites
        setFavoriteIds(prev => new Set([...prev, listing.id]));
        
        // Then perform the actual operation
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', listing.id);
        await setDoc(favoriteRef, {
          listingId: listing.id,
          createdAt: new Date()
        });
        
        // Add to local state
        const newFavorite = {
          id: listing.id,
          ...listing
        } as FavoriteListing;
        
        setFavorites(prev => [...prev, newFavorite]);
        
        // Show success toast with action to view favorites
        toast.success('Added to favorites', {
          action: {
            label: "View Favorites",
            onClick: () => router.push("/dashboard/favorites")
          },
          duration: 5000
        });
      }
    } catch (err) {
      console.error('Error updating favorite:', err);
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