import React, { useEffect } from 'react';
import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { ArrowRight } from 'lucide-react';
import { GameCategories } from './GameCategories';
import { useOptimizedSimilarListings, batchFetchUserData } from '@/hooks/useFirestoreOptimizer';

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

// Get related game categories
const getRelatedGameCategories = (game: string): string[] => {
  // Find the normalized game key
  const gameKey = Object.keys(GAME_NAME_MAPPING).find(key => 
    GAME_NAME_MAPPING[key as keyof typeof GAME_NAME_MAPPING].includes(game)
  );
  
  if (!gameKey) return [];
  
  // Return all variations of this game name for better matching
  return GAME_NAME_MAPPING[gameKey as keyof typeof GAME_NAME_MAPPING];
};

export const SimilarListings = ({ currentListing, maxListings = 6 }: SimilarListingsProps) => {
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  const router = useRouter();
  const { similarListings, isLoading } = useOptimizedSimilarListings(currentListing, maxListings);
  
  // Prefetch user data for all listings when component mounts
  useEffect(() => {
    if (similarListings.length > 0) {
      const userIds = similarListings.map(listing => listing.userId).filter(Boolean);
      if (userIds.length > 0) {
        batchFetchUserData(userIds);
      }
    }
  }, [similarListings]);

  const handleFavoriteClick = (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(listing, e);
  };

  return (
    <div className="mt-8">
      {/* Game Categories Section */}
      <div className="mb-6">
        <GameCategories />
      </div>
      
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
        <Carousel className="w-full">
          <CarouselContent className="-ml-4">
            {similarListings.map((listing) => (
              <CarouselItem key={listing.id} className="pl-4 md:basis-1/2 lg:basis-1/3" style={{ height: '100%' }}>
                <ListingCard
                  listing={listing}
                  isFavorite={initialized ? isFavorite(listing.id) : false}
                  onFavoriteClick={handleFavoriteClick}
                  getConditionColor={getConditionColor}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
      )}
    </div>
  );
};