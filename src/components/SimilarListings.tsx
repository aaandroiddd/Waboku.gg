import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, or, startAfter, documentId, QueryConstraint } from 'firebase/firestore';
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

// Calculate price range for similar listings - more lenient to show more results
const calculatePriceRange = (price: number): { min: number, max: number } => {
  // For lower priced items, use a wider range
  if (price < 50) {
    return {
      min: Math.max(0, price * 0.4),  // More lenient minimum
      max: price * 2.0                // More lenient maximum
    };
  }
  // For medium priced items
  else if (price < 200) {
    return {
      min: price * 0.5,               // More lenient minimum
      max: price * 1.8                // More lenient maximum
    };
  }
  // For higher priced items, use a wider range
  else {
    return {
      min: price * 0.6,               // More lenient minimum
      max: price * 1.6                // More lenient maximum
    };
  }
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
  
  // Sort listings by relevance to the current listing - with more lenient scoring
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

  const fetchSimilarListings = async () => {
    try {
      setIsLoading(true);
      setDebugInfo({
        queriesRun: 0,
        resultsPerQuery: {},
        totalListingsFetched: 0,
        error: null
      });
      
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
      
      // Extract meaningful keywords from title and description
      const titleKeywords = extractKeywords(currentListing.title);
      const descriptionKeywords = extractKeywords(currentListing.description);
      const cardNameKeywords = currentListing.cardName ? extractKeywords(currentListing.cardName) : [];
      
      // Combine unique keywords with priority to title and card name
      const allKeywords = [...new Set([
        ...cardNameKeywords,
        ...titleKeywords, 
        ...descriptionKeywords
      ])];
      
      // Get price range for similar listings
      const priceRange = calculatePriceRange(currentListing.price);
      
      // Get related game categories
      const relatedGames = getRelatedGameCategories(currentListing.game);
      
      // Create a multi-tiered approach to find similar listings
      let results: Listing[] = [];
      
      // Tier 1: Exact matches (same game + card name if available)
      if (results.length < maxListings && currentListing.cardName) {
        try {
          console.log(`Trying exact match query with game=${currentListing.game}, cardName=${currentListing.cardName}`);
          const exactMatchQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            where('cardName', '==', currentListing.cardName),
            where(documentId(), '!=', currentListing.id),
            limit(maxListings)
          );
          
          const exactMatchSnapshot = await getDocs(exactMatchQuery);
          console.log(`Exact match query returned ${exactMatchSnapshot.docs.length} results`);
          const exactMatches = processQueryResults(exactMatchSnapshot);
          results = [...results, ...exactMatches];
          
          setDebugInfo(prev => ({
            ...prev,
            queriesRun: prev.queriesRun + 1,
            resultsPerQuery: {
              ...prev.resultsPerQuery,
              'exactMatch': exactMatchSnapshot.docs.length
            }
          }));
        } catch (error) {
          console.error('Error in exact match query:', error);
        }
      }
      
      // Tier 2: Same game + similar price range (removed price constraints to be more lenient)
      if (results.length < maxListings) {
        try {
          console.log(`Trying same game query with game=${currentListing.game}`);
          const gameQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            where(documentId(), '!=', currentListing.id),
            limit(maxListings - results.length)
          );
          
          const gameSnapshot = await getDocs(gameQuery);
          console.log(`Same game query returned ${gameSnapshot.docs.length} results`);
          const gameMatches = processQueryResults(gameSnapshot);
          
          // Add only new listings that aren't already in results
          const newMatches = gameMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
          
          setDebugInfo(prev => ({
            ...prev,
            queriesRun: prev.queriesRun + 1,
            resultsPerQuery: {
              ...prev.resultsPerQuery,
              'sameGame': gameSnapshot.docs.length
            }
          }));
        } catch (error) {
          console.error('Error in same game query:', error);
        }
      }
      
      // Tier 3: Card name only (across any game)
      if (results.length < maxListings && currentListing.cardName) {
        try {
          console.log(`Trying card name query with cardName=${currentListing.cardName}`);
          const cardNameQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('cardName', '==', currentListing.cardName),
            where(documentId(), '!=', currentListing.id),
            limit(maxListings - results.length)
          );
          
          const cardNameSnapshot = await getDocs(cardNameQuery);
          console.log(`Card name query returned ${cardNameSnapshot.docs.length} results`);
          const cardNameMatches = processQueryResults(cardNameSnapshot);
          
          // Add only new listings
          const newMatches = cardNameMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
          
          setDebugInfo(prev => ({
            ...prev,
            queriesRun: prev.queriesRun + 1,
            resultsPerQuery: {
              ...prev.resultsPerQuery,
              'cardName': cardNameSnapshot.docs.length
            }
          }));
        } catch (error) {
          console.error('Error in card name query:', error);
        }
      }
      
      // Tier 4: Try related game categories if we still don't have enough
      if (results.length < maxListings && relatedGames.length > 0) {
        try {
          console.log(`Trying related games query with games=${relatedGames.filter(game => game !== currentListing.game).join(', ')}`);
          
          // Instead of using OR, which can be problematic, do individual queries for each related game
          const relatedGamesList = relatedGames.filter(game => game !== currentListing.game);
          
          for (const relatedGame of relatedGamesList) {
            if (results.length >= maxListings) break;
            
            const relatedGameQuery = query(
              listingsRef,
              where('status', '==', 'active'),
              where('game', '==', relatedGame),
              where(documentId(), '!=', currentListing.id),
              limit(maxListings - results.length)
            );
            
            const relatedGameSnapshot = await getDocs(relatedGameQuery);
            console.log(`Related game query for ${relatedGame} returned ${relatedGameSnapshot.docs.length} results`);
            const relatedGameMatches = processQueryResults(relatedGameSnapshot);
            
            // Add only new listings
            const newMatches = relatedGameMatches.filter(
              match => !results.some(existing => existing.id === match.id)
            );
            results = [...results, ...newMatches];
            
            setDebugInfo(prev => ({
              ...prev,
              queriesRun: prev.queriesRun + 1,
              resultsPerQuery: {
                ...prev.resultsPerQuery,
                [`relatedGame_${relatedGame}`]: relatedGameSnapshot.docs.length
              }
            }));
          }
        } catch (error) {
          console.error('Error in related games query:', error);
        }
      }
      
      // Tier 5: Any active listings (no game filter)
      if (results.length < maxListings) {
        try {
          console.log('Trying any active listings query');
          const anyActiveQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where(documentId(), '!=', currentListing.id),
            orderBy('createdAt', 'desc'),
            limit(maxListings - results.length)
          );
          
          const anyActiveSnapshot = await getDocs(anyActiveQuery);
          console.log(`Any active listings query returned ${anyActiveSnapshot.docs.length} results`);
          const anyActiveMatches = processQueryResults(anyActiveSnapshot);
          
          // Add only new listings
          const newMatches = anyActiveMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
          
          setDebugInfo(prev => ({
            ...prev,
            queriesRun: prev.queriesRun + 1,
            resultsPerQuery: {
              ...prev.resultsPerQuery,
              'anyActive': anyActiveSnapshot.docs.length
            }
          }));
        } catch (error) {
          console.error('Error in any active listings query:', error);
        }
      }
      
      // Tier 6: Last resort - get any active listings from any game if we still don't have enough
      // More aggressive with minimum count (6 instead of 3) and higher limit
      if (results.length < 6) {
        const lastResortQuery = query(
          listingsRef,
          where('status', '==', 'active'),
          where(documentId(), '!=', currentListing.id),
          orderBy('createdAt', 'desc'),
          limit(Math.max(maxListings, 12) - results.length) // Ensure we get at least some results
        );
        
        const lastResortSnapshot = await getDocs(lastResortQuery);
        const lastResortMatches = processQueryResults(lastResortSnapshot);
        
        // Add only new listings
        const newMatches = lastResortMatches.filter(
          match => !results.some(existing => existing.id === match.id)
        );
        results = [...results, ...newMatches];
        
        setDebugInfo(prev => ({
          ...prev,
          queriesRun: prev.queriesRun + 1,
          resultsPerQuery: {
            ...prev.resultsPerQuery,
            'lastResort': lastResortMatches.length
          }
        }));
      }
      
      // Tier 7: Absolute last resort - get ANY listings regardless of status
      // Only if we still have no results at all
      if (results.length === 0) {
        console.log('No results found in any tier, trying emergency fallback query');
        try {
          // Query without status filter to see if there are any listings at all
          const emergencyQuery = query(
            listingsRef,
            limit(maxListings)
          );
          
          const emergencySnapshot = await getDocs(emergencyQuery);
          console.log(`Emergency query found ${emergencySnapshot.docs.length} listings`);
          
          if (emergencySnapshot.docs.length > 0) {
            // If we found listings but they're not active, log this information
            const emergencyResults = processQueryResults(emergencySnapshot);
            console.log('Emergency results:', emergencyResults.map(l => ({
              id: l.id,
              status: l.status,
              game: l.game
            })));
            
            // Only use these as a last resort if they're not the current listing
            const filteredEmergency = emergencyResults.filter(
              match => match.id !== currentListing.id
            );
            
            if (filteredEmergency.length > 0) {
              results = filteredEmergency;
              console.log('Using emergency results as fallback');
            }
            
            setDebugInfo(prev => ({
              ...prev,
              queriesRun: prev.queriesRun + 1,
              resultsPerQuery: {
                ...prev.resultsPerQuery,
                'emergency': emergencyResults.length
              }
            }));
          }
        } catch (emergencyError) {
          console.error('Error in emergency query:', emergencyError);
        }
      }
      
      // Sort results by relevance score
      results = sortByRelevance(results, currentListing);
      
      // Limit to maxListings
      results = results.slice(0, maxListings);
      
      console.log(`Found ${results.length} similar listings after all queries`);
      setDebugInfo(prev => ({
        ...prev,
        totalListingsFetched: results.length
      }));
      
      setSimilarListings(results);
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