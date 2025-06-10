import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Listing } from '@/types/database';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { getFirebaseServices, removeListenersByPrefix } from '@/lib/firebase';
import { collection, query, where, limit, documentId, getDocs } from 'firebase/firestore';
import { ListingCard } from '@/components/ListingCard';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';

interface MobileSimilarItemsProps {
  currentListing: Listing;
  maxListings?: number;
}

export const MobileSimilarItems = ({ currentListing, maxListings = 6 }: MobileSimilarItemsProps) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const fetchedRef = useRef(false);

  // Add favorites functionality
  const { toggleFavorite, isFavorite, addFavoriteToGroup } = useFavorites();
  const { user } = useAuth();

  // Create a memoized fetch function
  const fetchSimilarListings = useCallback(async () => {
    if (!currentListing?.id || !currentListing?.game) return;
    
    try {
      setIsLoading(true);
      console.log(`[MobileSimilarItems] Fetching similar listings for game: ${currentListing.game}`);
      
      const { db } = getFirebaseServices();
      if (!db) throw new Error('Firebase DB not initialized');

      // Simple query for listings with the same game
      const gameQuery = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('game', '==', currentListing.game),
        where(documentId(), '!=', currentListing.id),
        limit(maxListings)
      );
      
      // Try a direct query first
      try {
        console.log('[MobileSimilarItems] Attempting direct query');
        const querySnapshot = await getDocs(gameQuery);
        
        if (!querySnapshot.empty) {
          console.log(`[MobileSimilarItems] Direct query successful, found ${querySnapshot.docs.length} listings`);
          
          const results = querySnapshot.docs.map(doc => {
            const data = doc.data();
            
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              expiresAt: data.expiresAt?.toDate() || new Date(),
              price: Number(data.price) || 0,
              imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
              isGraded: Boolean(data.isGraded),
              gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
              status: data.status || 'active',
              condition: data.condition || 'Not specified',
              game: data.game || 'Not specified',
              city: data.city || 'Unknown',
              state: data.state || 'Unknown',
              gradingCompany: data.gradingCompany || undefined,
              offersOnly: data.offersOnly === true
            };
          });
          
          // Sort by newest first
          const sortedResults = results.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          setSimilarListings(sortedResults);
          setIsLoading(false);
          fetchedRef.current = true;
          return;
        }
      } catch (directQueryError) {
        console.error('[MobileSimilarItems] Direct query failed:', directQueryError);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[MobileSimilarItems] Error fetching similar listings:', error);
      setIsLoading(false);
    }
  }, [currentListing?.id, currentListing?.game, maxListings]);

  // Effect to trigger fetch when component mounts
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchSimilarListings();
    }
    
    // Cleanup function
    return () => {
      if (currentListing?.id) {
        const cleanupId = `mobile-similar-listings-${currentListing.id}`;
        removeListenersByPrefix(cleanupId);
      }
    };
  }, [currentListing?.id, fetchSimilarListings]);

  // Handle favorite click
  const handleFavoriteClick = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    toggleFavorite(listing, e);
  }, [user, toggleFavorite, router]);

  // Condition color function for ListingCard
  const getConditionColor = useCallback((condition: string) => {
    const conditionColors: Record<string, { base: string; hover: string }> = {
      'poor': {
        base: 'bg-[#e51f1f]/20 text-[#e51f1f] border border-[#e51f1f]/30',
        hover: 'hover:bg-[#e51f1f]/30'
      },
      'played': {
        base: 'bg-[#e85f2a]/20 text-[#e85f2a] border border-[#e85f2a]/30',
        hover: 'hover:bg-[#e85f2a]/30'
      },
      'light played': {
        base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
        hover: 'hover:bg-[#f2a134]/30'
      },
      'light-played': {
        base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
        hover: 'hover:bg-[#f2a134]/30'
      },
      'good': {
        base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
        hover: 'hover:bg-[#f2a134]/30'
      },
      'excellent': {
        base: 'bg-[#f7e379]/20 text-[#f7e379] border border-[#f7e379]/30',
        hover: 'hover:bg-[#f7e379]/30'
      },
      'near mint': {
        base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
        hover: 'hover:bg-[#7bce2a]/30'
      },
      'near-mint': {
        base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
        hover: 'hover:bg-[#7bce2a]/30'
      },
      'near_mint': {
        base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
        hover: 'hover:bg-[#7bce2a]/30'
      },
      'mint': {
        base: 'bg-[#44ce1b]/20 text-[#44ce1b] border border-[#44ce1b]/30',
        hover: 'hover:bg-[#44ce1b]/30'
      }
    };

    const defaultColor = { base: 'bg-gray-500/20 text-gray-500 border border-gray-500/30', hover: 'hover:bg-gray-500/30' };
    return conditionColors[condition?.toLowerCase()] || defaultColor;
  }, []);

  if (isLoading) {
    return (
      <div className="px-4 py-6 bg-background">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Similar Items</h2>
          <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-muted rounded-lg mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (similarListings.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-6 bg-background border-t border-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Similar Items</h2>
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/listings?game=${currentListing.game}`)}
          className="text-primary hover:text-primary/80 text-sm font-medium"
        >
          See all
        </Button>
      </div>
      
      {/* Grid layout similar to /listings/ page */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 auto-rows-fr">
        {similarListings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isFavorite={user ? isFavorite(listing.id) : false}
            onFavoriteClick={handleFavoriteClick}
            onAddToGroup={(listingId, groupId) => addFavoriteToGroup(listing, groupId)}
            getConditionColor={getConditionColor}
          />
        ))}
      </div>
    </div>
  );
};