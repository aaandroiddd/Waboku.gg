import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, or } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { ArrowRight } from 'lucide-react';

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

export const SimilarListings = ({ currentListing, maxListings = 9 }: SimilarListingsProps) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  const router = useRouter();

  useEffect(() => {
    const fetchSimilarListings = async () => {
      try {
        setIsLoading(true);
        const { db } = await getFirebaseServices();
        
        // Create query to find similar listings based on game, title keywords, or description
        const listingsRef = collection(db, 'listings');
        
        // Extract keywords from title and description
        const titleWords = currentListing.title.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        const descriptionWords = currentListing.description.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        
        // Combine unique keywords
        const keywords = [...new Set([...titleWords, ...descriptionWords])].slice(0, 5);
        
        // Create query conditions
        const queryConditions = [
          // Match by game (highest priority)
          where('game', '==', currentListing.game),
          
          // Match by card name if available
          ...(currentListing.cardName ? [where('cardName', '==', currentListing.cardName)] : []),
        ];
        
        // Only show active listings
        const statusCondition = where('status', '==', 'active');
        
        // Exclude current listing
        const excludeCurrentCondition = where('id', '!=', currentListing.id);
        
        // Create the query
        const q = query(
          listingsRef,
          statusCondition,
          or(...queryConditions),
          orderBy('createdAt', 'desc'),
          limit(maxListings + 1) // Fetch one extra to account for filtering out current listing
        );
        
        const querySnapshot = await getDocs(q);
        
        // Process results
        let results = querySnapshot.docs.map(doc => {
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
            gradingCompany: data.gradingCompany || undefined
          } as Listing;
        });
        
        // Filter out the current listing
        results = results.filter(listing => listing.id !== currentListing.id);
        
        // Limit to maxListings
        results = results.slice(0, maxListings);
        
        setSimilarListings(results);
      } catch (error) {
        console.error('Error fetching similar listings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentListing?.id) {
      fetchSimilarListings();
    }
  }, [currentListing, maxListings]);

  const handleFavoriteClick = (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(listing, e);
  };

  if (isLoading) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Similar Listings</h2>
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
      </div>
    );
  }

  if (similarListings.length === 0) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Similar Listings</h2>
        <Card className="bg-muted/30">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">No similar listings found at this time.</p>
            <Button onClick={() => router.push('/listings')}>
              View All Listings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Similar Listings</h2>
        <Button variant="ghost" onClick={() => router.push('/listings')} className="flex items-center">
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-4">
          {similarListings.map((listing) => (
            <CarouselItem key={listing.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
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
    </div>
  );
};