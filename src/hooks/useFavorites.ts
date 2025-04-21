// useFavorites.ts
import { firebaseDb as db } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/router';

export interface FavoriteFilters {
  search?: string;
  game?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  groupId?: string | null;
}

export interface FavoriteListing extends Listing {
  groupId?: string | null;
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
  const [filters, setFilters] = useState<FavoriteFilters>({});
  
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
            const favoriteData = favoriteDoc.data();
            
            return {
              id: listingDoc.id,
              ...data,
              createdAt: data.createdAt?.toDate(),
              archivedAt: data.archivedAt?.toDate(),
              groupId: favoriteData.groupId || null
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

  // UPDATED: Modified toggleFavorite function to show dialog when adding a new favorite
  const toggleFavorite = async (listing: Listing, event?: React.MouseEvent) => {
    // Prevent event propagation if event is provided
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!user) {
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

    if (isFav) {
      // If it's already a favorite, remove it
      try {
        // Mark operation as pending
        setPendingOperations(prev => new Set([...prev, listing.id]));
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
      } catch (err) {
        console.error('Error removing favorite:', err);
        setError(err instanceof Error ? err.message : 'Failed to update favorite');
        toast.error('Failed to update favorites');
        
        // Revert optimistic updates on error
        setFavoriteIds(prev => new Set([...prev, listing.id]));
        setFavorites(prev => [...prev, listing]);
      } finally {
        // Remove from pending operations
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(listing.id);
          return newSet;
        });
      }
    } else {
      // If it's not a favorite yet, we don't add it directly
      // Instead, we return a function that will show the Add to Group dialog
      return { showAddToGroupDialog: true, listing };
    }
  };

  // NEW: Add a function to handle save button clicks
  const handleSaveButtonClick = (listing: Listing, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!user) {
      toast.error('Please sign in to save favorites');
      saveRedirectState('toggle_favorite', { listingId: listing.id });
      router.push('/auth/sign-in');
      return;
    }
    
    // Always return { showAddToGroupDialog: true, listing } for the save button
    return { showAddToGroupDialog: true, listing };
  };
  
  // Add a favorite directly to a specific group
  const addFavoriteToGroup = async (listingId: string, groupId: string | null) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      saveRedirectState('add_favorite_to_group', { listingId: listingId, groupId });
      router.push('/auth/sign-in');
      return;
    }

    // Prevent duplicate operations on the same listing
    if (pendingOperations.has(listingId)) {
      console.log('Operation already in progress for listing:', listingId);
      return;
    }

    const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
    const isFav = favoriteIds.has(listingId);

    try {
      // Mark operation as pending
      setPendingOperations(prev => new Set([...prev, listingId]));
      
      if (isFav) {
        // If already a favorite, just update the group
        await updateDoc(favoriteRef, { groupId });
        
        // Update local state
        setFavorites(prev => 
          prev.map(fav => 
            fav.id === listingId ? { ...fav, groupId } : fav
          )
        );
        
        // Show success toast with action to view favorites
        toast.success('Updated favorite group', {
          action: {
            label: "View Favorites",
            onClick: () => router.push("/dashboard/favorites")
          },
          duration: 5000
        });
      } else {
        // Optimistically add to favorites
        setFavoriteIds(prev => new Set([...prev, listingId]));
        
        // Then perform the actual operation
        await setDoc(favoriteRef, {
          listingId: listingId,
          createdAt: new Date(),
          groupId
        });
        
        // Fetch the listing to add to local state
        const listingDoc = await getDoc(doc(db, 'listings', listingId));
        if (listingDoc.exists()) {
          const data = listingDoc.data();
          
          const newFavorite = {
            id: listingId,
            ...data,
            createdAt: data.createdAt?.toDate(),
            archivedAt: data.archivedAt?.toDate(),
            groupId
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
      }
      
      return true;
    } catch (err) {
      console.error('Error adding favorite to group:', err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
      toast.error('Failed to add to favorites');
      
      // Revert optimistic updates if not already a favorite
      if (!isFav) {
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(listingId);
          return newSet;
        });
        setFavorites(prev => prev.filter(f => f.id !== listingId));
      }
      
      return false;
    } finally {
      // Remove from pending operations
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(listingId);
        return newSet;
      });
    }
  };

  const updateFavoriteGroup = async (listingId: string, groupId: string | null) => {
    if (!user) {
      toast.error('Please sign in to update favorites');
      return false;
    }

    try {
      const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
      
      // Update in Firestore
      await updateDoc(favoriteRef, { groupId });
      
      // Update local state
      setFavorites(prev => 
        prev.map(fav => 
          fav.id === listingId ? { ...fav, groupId } : fav
        )
      );
      
      return true;
    } catch (err) {
      console.error('Error updating favorite group:', err);
      throw err;
    }
  };

  const isFavorite = useCallback((listingId: string) => {
    return favoriteIds.has(listingId);
  }, [favoriteIds]);
  
  const isPending = useCallback((listingId: string) => {
    return pendingOperations.has(listingId);
  }, [pendingOperations]);

  // Apply filters to favorites
  const filteredFavorites = useMemo(() => {
    let result = [...favorites];
    
    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(listing => 
        listing.title.toLowerCase().includes(searchTerm) ||
        (listing.description && listing.description.toLowerCase().includes(searchTerm))
      );
    }
    
    // Filter by game
    if (filters.game) {
      result = result.filter(listing => listing.game === filters.game);
    }
    
    // Filter by price range
    if (filters.priceRange) {
      if (filters.priceRange.min !== undefined) {
        result = result.filter(listing => 
          (listing.price !== undefined && listing.price >= filters.priceRange!.min!)
        );
      }
      
      if (filters.priceRange.max !== undefined) {
        result = result.filter(listing => 
          (listing.price !== undefined && listing.price <= filters.priceRange!.max!)
        );
      }
    }
    
    // Filter by group
    if (filters.groupId !== undefined) {
      result = result.filter(listing => listing.groupId === filters.groupId);
    }
    
    return result;
  }, [favorites, filters]);

  useEffect(() => {
    fetchFavorites().then(() => {
      setInitialized(true);
    });
  }, [user, fetchFavorites]);

  return {
    favorites: filteredFavorites,
    allFavorites: favorites,
    isLoading,
    error,
    toggleFavorite,
    addFavoriteToGroup,
    updateFavoriteGroup,
    isFavorite,
    isPending,
    setFilters,
    filters,
    refresh: fetchFavorites,
    initialized,
    handleSaveButtonClick  // NEW: Added this to the returned object
  };
}
