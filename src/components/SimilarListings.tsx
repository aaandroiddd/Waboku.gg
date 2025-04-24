import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, or, documentId, QueryConstraint } from 'firebase/firestore';
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

// Extract meaningful keywords from text
const extractKeywords = (text: string): string[] => {
  if (!text) return [];
  
  // Remove special characters and convert to lowercase
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Split by whitespace and filter out common words and short words
  const commonWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'card', 'cards', 'listing', 'sale', 'selling']);
  return cleanText.split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !commonWords.has(word) && 
      !(/^\d+$/.test(word)) // Filter out numbers-only words
    )
    .slice(0, 10); // Limit to 10 keywords
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
  const [debugInfo, setDebugInfo] = useState<{
    queriesRun: number;
    resultsPerQuery: Record<string, number>;
    totalListingsFetched: number;
    error: string | null;
  }>({
    queriesRun: 0,
    resultsPerQuery: {},
    totalListingsFetched: 0,
    error: null
  });
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  const router = useRouter();

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
      
      // Same game is high priority but not as dominant
      if (a.game === currentListing.game) scoreA += 80;
      if (b.game === currentListing.game) scoreB += 80;
      
      // Related game categories get some points too
      const relatedGames = getRelatedGameCategories(currentListing.game);
      if (relatedGames.includes(a.game)) scoreA += 40;
      if (relatedGames.includes(b.game)) scoreB += 40;
      
      // Same card name is very important
      if (a.cardName && currentListing.cardName && 
          a.cardName.toLowerCase() === currentListing.cardName.toLowerCase()) scoreA += 70;
      if (b.cardName && currentListing.cardName && 
          b.cardName.toLowerCase() === currentListing.cardName.toLowerCase()) scoreB += 70;
      
      // Partial card name match
      if (a.cardName && currentListing.cardName && 
          (a.cardName.toLowerCase().includes(currentListing.cardName.toLowerCase()) || 
           currentListing.cardName.toLowerCase().includes(a.cardName.toLowerCase()))) scoreA += 30;
      if (b.cardName && currentListing.cardName && 
          (b.cardName.toLowerCase().includes(currentListing.cardName.toLowerCase()) || 
           currentListing.cardName.toLowerCase().includes(b.cardName.toLowerCase()))) scoreB += 30;
      
      // Similar condition
      if (a.condition === currentListing.condition) scoreA += 30;
      if (b.condition === currentListing.condition) scoreB += 30;
      
      // Similar grading status
      if (a.isGraded === currentListing.isGraded) scoreA += 20;
      if (b.isGraded === currentListing.isGraded) scoreB += 20;
      
      // Same grading company
      if (a.gradingCompany && currentListing.gradingCompany && 
          a.gradingCompany === currentListing.gradingCompany) scoreA += 15;
      if (b.gradingCompany && currentListing.gradingCompany && 
          b.gradingCompany === currentListing.gradingCompany) scoreB += 15;
      
      // Similar price (more lenient - within 40%)
      const priceRangeA = Math.abs(a.price - currentListing.price) / currentListing.price;
      const priceRangeB = Math.abs(b.price - currentListing.price) / currentListing.price;
      if (priceRangeA <= 0.4) scoreA += 15;
      if (priceRangeB <= 0.4) scoreB += 15;
      
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
      
      // Cache expires after 30 minutes
      const cacheExpiry = 30 * 60 * 1000; // 30 minutes in milliseconds
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
    try {
      setIsLoading(true);
      setDebugInfo({
        queriesRun: 0,
        resultsPerQuery: {},
        totalListingsFetched: 0,
        error: null
      });
      
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
        setDebugInfo(prev => ({
          ...prev,
          error: 'Firebase DB is not initialized'
        }));
        setIsLoading(false);
        return;
      }
      
      console.log('Fetching similar listings for:', currentListing.id);
      const listingsRef = collection(db, 'listings');
      
      // Get related game categories
      const relatedGames = getRelatedGameCategories(currentListing.game);
      
      // OPTIMIZATION: Consolidated query approach
      // Instead of multiple tiered queries, use a single query with OR conditions
      let results: Listing[] = [];
      
      // Create a consolidated query that covers most important cases
      try {
        // Build an array of OR conditions for the query
        const orConditions = [];
        
        // 1. Same game + card name (if available)
        if (currentListing.cardName) {
          orConditions.push([
            where('game', '==', currentListing.game),
            where('cardName', '==', currentListing.cardName)
          ]);
        }
        
        // 2. Same game (without card name constraint)
        orConditions.push([
          where('game', '==', currentListing.game)
        ]);
        
        // 3. Same card name (across any game)
        if (currentListing.cardName) {
          orConditions.push([
            where('cardName', '==', currentListing.cardName)
          ]);
        }
        
        // 4. Related games (up to 2 to limit query complexity)
        const limitedRelatedGames = relatedGames
          .filter(game => game !== currentListing.game)
          .slice(0, 2);
          
        for (const relatedGame of limitedRelatedGames) {
          orConditions.push([
            where('game', '==', relatedGame)
          ]);
        }
        
        // Create a single query with common constraints
        const commonConstraints: QueryConstraint[] = [
          where('status', '==', 'active'),
          where(documentId(), '!=', currentListing.id),
          limit(maxListings * 2) // Fetch more than needed to allow for filtering
        ];
        
        // Execute the query for each OR condition and combine results
        let allResults: Listing[] = [];
        
        for (let i = 0; i < orConditions.length; i++) {
          if (allResults.length >= maxListings * 2) break;
          
          const conditions = orConditions[i];
          const queryConstraints = [...commonConstraints, ...conditions];
          
          const q = query(listingsRef, ...queryConstraints);
          const querySnapshot = await getDocs(q);
          
          console.log(`OR condition ${i+1} returned ${querySnapshot.docs.length} results`);
          
          const processedResults = processQueryResults(querySnapshot);
          
          // Add only new listings that aren't already in results
          const newResults = processedResults.filter(
            result => !allResults.some(existing => existing.id === result.id)
          );
          
          allResults = [...allResults, ...newResults];
          
          setDebugInfo(prev => ({
            ...prev,
            queriesRun: prev.queriesRun + 1,
            resultsPerQuery: {
              ...prev.resultsPerQuery,
              [`condition_${i+1}`]: querySnapshot.docs.length
            }
          }));
        }
        
        // If we still don't have enough results, try a fallback query
        if (allResults.length < 3) {
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
            result => !allResults.some(existing => existing.id === result.id)
          );
          
          allResults = [...allResults, ...newResults];
          
          setDebugInfo(prev => ({
            ...prev,
            queriesRun: prev.queriesRun + 1,
            resultsPerQuery: {
              ...prev.resultsPerQuery,
              'fallback': fallbackSnapshot.docs.length
            }
          }));
        }
        
        // Sort results by relevance score
        results = sortByRelevance(allResults, currentListing);
        
        // Limit to maxListings
        results = results.slice(0, maxListings);
        
        console.log(`Found ${results.length} similar listings after consolidated queries`);
        setDebugInfo(prev => ({
          ...prev,
          totalListingsFetched: results.length
        }));
        
        // Save to cache for future use
        saveSimilarListingsToCache(results);
        
        setSimilarListings(results);
      } catch (error) {
        console.error('Error in consolidated query approach:', error);
        setDebugInfo(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : String(error)
        }));
      }
    } catch (error) {
      console.error('Error fetching similar listings:', error);
      setDebugInfo(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error)
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentListing?.id) {
      fetchSimilarListings();
    }
  }, [currentListing?.id]); // Only depend on the ID, not the entire listing object

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
            <div className="flex flex-col sm:flex-row gap-2 justify-center mb-4">
              <Button onClick={() => router.push('/listings')}>
                View All Listings
              </Button>
              <Button 
                variant="outline" 
                onClick={() => fetchSimilarListings()} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Fetching...' : 'Fetch Similar Listings'}
              </Button>
            </div>
            
            {/* Debug information - only shown in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 text-left text-xs border-t pt-4">
                <p className="font-semibold mb-1">Debug Info:</p>
                <p>Queries run: {debugInfo.queriesRun}</p>
                <p>Results per query: {
                  Object.entries(debugInfo.resultsPerQuery).map(([key, value]) => 
                    `${key}: ${value}`
                  ).join(', ') || 'None'
                }</p>
                {debugInfo.error && <p className="text-red-500">Error: {debugInfo.error}</p>}
              </div>
            )}
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
    </div>
  );
};