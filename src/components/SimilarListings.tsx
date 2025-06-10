import React, { useMemo, useEffect, useRef, useState } from 'react';
import { removeListenersByPrefix } from '@/lib/firebaseConnectionManager';
import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOptimizedSimilarListings } from '@/hooks/useFirestoreOptimizer';

// Define the game name mapping object that was missing
const GAME_NAME_MAPPING: Record<string, string[]> = {
  pokemon: ['Pokemon', 'Pokemon TCG', 'Pokemon Trading Card Game'],
  yugioh: ['Yu-Gi-Oh!', 'Yu-Gi-Oh', 'Yugioh', 'Yu Gi Oh'],
  magic: ['Magic: The Gathering', 'Magic The Gathering', 'MTG'],
  // Add other game mappings as needed
};

interface SimilarListingsProps {
  currentListing: Listing;
  maxListings?: number;
}

const getConditionColor = (condition: string) => {
  const colors: Record<string, { base: string; hover: string }> = {
    'poor': { base: 'bg-[#e51f1f]/10 text-[#e51f1f]', hover: 'hover:bg-[#e51f1f]/20' },
    'played': { base: 'bg-[#e85f2a]/10 text-[#e85f2a]', hover: 'hover:bg-[#e85f2a]/20' },
    'light-played': { base: 'bg-[#f2a134]/10 text-[#f2a134]', hover: 'hover:bg-[#f2a134]/20' },
    'good': { base: 'bg-[#f2a134]/10 text-[#f2a134]', hover: 'hover:bg-[#f2a134]/20' },
    'excellent': { base: 'bg-[#f7e379]/10 text-[#f7e379]', hover: 'hover:bg-[#f7e379]/20' },
    'near-mint': { base: 'bg-[#7bce2a]/10 text-[#7bce2a]', hover: 'hover:bg-[#7bce2a]/20' },
    'near mint': { base: 'bg-[#7bce2a]/10 text-[#7bce2a]', hover: 'hover:bg-[#7bce2a]/20' },
    'near_mint': { base: 'bg-[#7bce2a]/10 text-[#7bce2a]', hover: 'hover:bg-[#7bce2a]/20' },
    'mint': { base: 'bg-[#44ce1b]/10 text-[#44ce1b]', hover: 'hover:bg-[#44ce1b]/20' },
    'unknown': { base: 'bg-gray-500/10 text-gray-500', hover: 'hover:bg-gray-500/20' }
  };
  return colors[condition?.toLowerCase()] || { base: 'bg-gray-500/10 text-gray-500', hover: 'hover:bg-gray-500/20' };
};

export const SimilarListings = ({ currentListing, maxListings = 6 }: SimilarListingsProps) => {
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  const router = useRouter();
  
  // Carousel API for mobile navigation
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Update scroll state when API changes
  useEffect(() => {
    if (!api) return;

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    updateScrollState();
    api.on('select', updateScrollState);

    return () => {
      api.off('select', updateScrollState);
    };
  }, [api]);
  
  // Create a stable options object that only changes when truly necessary
  const listingOptions = useMemo(() => 
    currentListing?.id ? {
      id: currentListing.id,
      game: currentListing.game || 'unknown',
      maxCount: maxListings
    } : null, 
    [currentListing?.id, currentListing?.game, maxListings]
  );
  
  // Use the optimized hook with the memoized options
  const { similarListings, isLoading } = useOptimizedSimilarListings(listingOptions);
  
  // Register a cleanup function for when the component unmounts
  useEffect(() => {
    // Define a cleanup function
    const cleanupId = `similar-listings-${currentListing?.id || 'unknown'}`;
    
    return () => {
      console.log(`[SimilarListings] Component unmounted for listing ${currentListing?.id}`);
      
      // Clean up any listeners with this prefix
      removeListenersByPrefix(cleanupId);
      
      // Clean up any cached data in window.__firestoreCache
      if (typeof window !== 'undefined' && 
          window.__firestoreCache?.similarListings && 
          currentListing?.id) {
        console.log(`[SimilarListings] Removing cache for ${currentListing.id}`);
        delete window.__firestoreCache.similarListings[currentListing.id];
      }
    };
  }, [currentListing?.id]);
  
  const handleFavoriteClick = (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(listing, e);
  };

  return (
    <div className="mt-8">
      {/* Similar Listings Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Similar Listings</h2>
        <Button variant="ghost" onClick={() => router.push('/listings')} className="flex items-center">
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="aspect-square bg-muted rounded-lg mb-4"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : similarListings.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">No similar listings found at this time.</p>
            <Button onClick={() => router.push('/listings')}>
              View All Listings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Carousel className="w-full" setApi={setApi}>
            <CarouselContent className="-ml-4">
              {similarListings.map((listing, index) => (
                <CarouselItem key={`${listing.id}-${index}-${listing.imageUrls?.[0] || 'no-image'}`} className="pl-4 md:basis-1/2 lg:basis-1/3" style={{ height: '100%' }}>
                  <ListingCard
                    listing={listing}
                    isFavorite={initialized ? isFavorite(listing.id) : false}
                    onFavoriteClick={(e) => handleFavoriteClick(e, listing)}
                    getConditionColor={getConditionColor}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {/* Desktop arrows - hidden on mobile */}
            <CarouselPrevious className="hidden md:flex" />
            <CarouselNext className="hidden md:flex" />
          </Carousel>
          
          {/* Mobile navigation arrows - shown only on mobile */}
          <div className="flex justify-center gap-4 mt-4 md:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => api?.scrollPrev()}
              disabled={!canScrollPrev}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => api?.scrollNext()}
              disabled={!canScrollNext}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
