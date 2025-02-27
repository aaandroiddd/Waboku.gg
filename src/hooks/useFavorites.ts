import { firebaseDb as db } from '@/lib/firebase';
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

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      const favoritesRef = collection(db, 'users', user.uid, 'favorites');
      const favoritesSnapshot = await getDocs(favoritesRef);
      
      const favoriteIdsSet = new Set<string>();
      const favoritePromises = favoritesSnapshot.docs.map(async (doc) => {
        const listingId = doc.id;
        favoriteIdsSet.add(listingId);
        
        // First try to get the data from the stored listingData
        const favoriteData = doc.data();
        if (favoriteData.listingData) {
          const listingData = favoriteData.listingData;
          return {
            ...listingData,
            createdAt: listingData.createdAt instanceof Date ? listingData.createdAt : listingData.createdAt.toDate(),
            archivedAt: listingData.archivedAt instanceof Date ? listingData.archivedAt : listingData.archivedAt?.toDate()
          } as Listing;
        }
        
        // Fallback to fetching from the listing reference if listingData is not available
        try {
          const listingRef = doc(db, 'listings', listingId);
          const listingDoc = await getDoc(listingRef);
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
          console.error('Error fetching listing:', err);
        }
        return null;
      });

      const resolvedFavorites = (await Promise.all(favoritePromises))
        .filter((f): f is Listing => f !== null)
        // Filter out archived listings
        .filter(listing => !listing.archivedAt && listing.status !== 'archived');
      setFavorites(resolvedFavorites);
      setFavoriteIds(favoriteIdsSet);
    } catch (err) {
      console.error('Error in fetchFavorites:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch favorites');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = async (listing: Listing) => {
    if (!user) return;

    const favoriteRef = doc(db, 'users', user.uid, 'favorites', listing.id);
    const listingRef = doc(db, 'listings', listing.id);

    try {
      if (favoriteIds.has(listing.id)) {
        // Remove from favorites
        await deleteDoc(favoriteRef);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(listing.id);
          return newSet;
        });
        setFavorites(prev => prev.filter(f => f.id !== listing.id));
        
        // Update favorite count in the listing document (decrement)
        const listingDoc = await getDoc(listingRef);
        if (listingDoc.exists()) {
          const currentData = listingDoc.data();
          const currentCount = currentData.favoriteCount || 0;
          await setDoc(listingRef, {
            ...currentData,
            favoriteCount: Math.max(0, currentCount - 1)
          }, { merge: true });
        }
      } else {
        // Add to favorites
        await setDoc(favoriteRef, {
          listingRef,
          listingData: {
            ...listing,
            createdAt: listing.createdAt,
            id: listing.id
          },
          createdAt: new Date()
        });
        setFavoriteIds(prev => new Set([...prev, listing.id]));
        setFavorites(prev => [...prev, listing]);
        
        // Update favorite count in the listing document (increment)
        const listingDoc = await getDoc(listingRef);
        if (listingDoc.exists()) {
          const currentData = listingDoc.data();
          const currentCount = currentData.favoriteCount || 0;
          await setDoc(listingRef, {
            ...currentData,
            favoriteCount: currentCount + 1
          }, { merge: true });
        }
      }
    } catch (err) {
      console.error('Error in toggleFavorite:', err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
      // Re-fetch favorites to ensure UI is in sync even if there was an error
      await fetchFavorites();
    }
  };

  const isFavorite = (listingId: string) => favoriteIds.has(listingId);

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  return {
    favorites,
    isLoading,
    error,
    toggleFavorite,
    isFavorite,
    refresh: fetchFavorites
  };
}