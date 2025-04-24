import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit, documentId } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { GAME_NAME_MAPPING } from '@/lib/game-mappings';
import { GameCategories } from './GameCategories';

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

export const SimilarListings = ({ currentListing, maxListings = 9 }: SimilarListingsProps) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  const router = useRouter();
  const fetchedRef = useRef(false);

  // Process query results into Listing objects
  const processQueryResults = (querySnapshot: any): Listing[] => {
    return querySnapshot.docs.map((doc: any) => {
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
  };
  
  // Sort listings by relevance to the current listing
  const sortByRelevance = (listings: Listing[], currentListing: Listing): Listing[] => {
    return listings.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // Same game is high priority
      if (a.game === currentListing.game) scoreA += 80;
      if (b.game === currentListing.game) scoreB += 80;
      
      // Same card name is very important
      if (a.cardName && currentListing.cardName && 
          a.cardName.toLowerCase() === currentListing.cardName.toLowerCase()) scoreA += 70;
      if (b.cardName && currentListing.cardName && 
          b.cardName.toLowerCase() === currentListing.cardName.toLowerCase()) scoreB += 70;
      
      // Similar condition
      if (a.condition === currentListing.condition) scoreA += 30;
      if (b.condition === currentListing.condition) scoreB += 30;
      
      // Newer listings get a small boost
      const ageA = new Date().getTime() - a.createdAt.getTime();
      const ageB = new Date().getTime() - b.createdAt.getTime();
      if (ageA < ageB) scoreA += 10;
      if (ageB < ageA) scoreB += 10;
      
      return scoreB - scoreA;
    });
  };

  // Check cache for similar listings
  const getSimilarListingsFromCache = (): Listing[] | null => {
    try {
      const cacheKey = `similarListings_${currentListing.id}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Cache expires after 2 hours
      const cacheExpiry = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      if (Date.now() - timestamp > cacheExpiry) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error retrieving from cache:', error);
      return null;
    }
  };

  // Save similar listings to cache
  const saveSimilarListingsToCache = (listings: Listing[]) => {
    try {
      const cacheKey = `similarListings_${currentListing.id}`;
      const cacheData = {
        data: listings,
        timestamp: Date.now()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  const fetchSimilarListings = async () => {
    // Prevent multiple fetches
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    
    try {
      setIsLoading(true);
      
      // Check cache first
      const cachedListings = getSimilarListingsFromCache();
      if (cachedListings && cachedListings.length > 0) {
        console.log(`Using ${cachedListings.length} cached similar listings`);
        setSimilarListings(cachedListings);
        setIsLoading(false);
        return;
      }
      
      const { db } = await getFirebaseServices();
      if (!db) {
        console.error('Firebase DB is not initialized');
        setIsLoading(false);
        return;
      }
      
      console.log('Fetching similar listings for:', currentListing.id);
      const listingsRef = collection(db, 'listings');
      
      // Simple query approach - just get listings with the same game
      const gameQuery = query(
        listingsRef,
        where('status', '==', 'active'),
        where('game', '==', currentListing.game),
        where(documentId(), '!=', currentListing.id),
        limit(maxListings * 2)
      );
      
      const querySnapshot = await getDocs(gameQuery);
      let results = processQueryResults(querySnapshot);
      
      // If we don't have enough results, try a fallback query
      if (results.length < 3) {
        const fallbackQuery = query(
          listingsRef,
          where('status', '==', 'active'),
          where(documentId(), '!=', currentListing.id),
          orderBy('createdAt', 'desc'),
          limit(maxListings)
        );
        
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const fallbackResults = processQueryResults(fallbackSnapshot);
        
        // Add only new listings
        const newResults = fallbackResults.filter(
          result => !results.some(existing => existing.id === result.id)
        );
        
        results = [...results, ...newResults];
      }
      
      // Sort results by relevance score
      results = sortByRelevance(results, currentListing);
      
      // Limit to maxListings
      results = results.slice(0, maxListings);
      
      console.log(`Found ${results.length} similar listings`);
      
      // Save to cache for future use
      saveSimilarListingsToCache(results);
      
      setSimilarListings(results);
    } catch (error) {
      console.error('Error fetching similar listings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentListing?.id) {
      fetchSimilarListings();
    }
    
    // Cleanup function
    return () => {
      fetchedRef.current = false;
    };
  }, [currentListing?.id]); // Only depend on the ID, not the entire listing object

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