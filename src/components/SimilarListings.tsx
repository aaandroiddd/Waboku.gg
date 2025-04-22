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
import { ArrowRight } from 'lucide-react';
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

// Calculate price range for similar listings
const calculatePriceRange = (price: number): { min: number, max: number } => {
  // For lower priced items, use a smaller range
  if (price < 50) {
    return {
      min: Math.max(0, price * 0.6),
      max: price * 1.5
    };
  }
  // For medium priced items
  else if (price < 200) {
    return {
      min: price * 0.7,
      max: price * 1.4
    };
  }
  // For higher priced items, use a wider range
  else {
    return {
      min: price * 0.75,
      max: price * 1.3
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
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  const router = useRouter();

  useEffect(() => {
    const fetchSimilarListings = async () => {
      try {
        setIsLoading(true);
        const { db } = await getFirebaseServices();
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
          const exactMatchQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            where('cardName', '==', currentListing.cardName),
            where(documentId(), '!=', currentListing.id),
            limit(maxListings)
          );
          
          const exactMatchSnapshot = await getDocs(exactMatchQuery);
          const exactMatches = processQueryResults(exactMatchSnapshot);
          results = [...results, ...exactMatches];
        }
        
        // Tier 2: Same game + similar condition + similar price range
        if (results.length < maxListings) {
          const gameConditionQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            where('condition', '==', currentListing.condition),
            where('price', '>=', priceRange.min),
            where('price', '<=', priceRange.max),
            where(documentId(), '!=', currentListing.id),
            limit(maxListings - results.length)
          );
          
          const gameConditionSnapshot = await getDocs(gameConditionQuery);
          const gameConditionMatches = processQueryResults(gameConditionSnapshot);
          
          // Add only new listings that aren't already in results
          const newMatches = gameConditionMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
        }
        
        // Tier 3: Same game + similar grading status
        if (results.length < maxListings) {
          const gradingConstraints: QueryConstraint[] = [];
          
          if (currentListing.isGraded) {
            gradingConstraints.push(where('isGraded', '==', true));
            if (currentListing.gradingCompany) {
              gradingConstraints.push(where('gradingCompany', '==', currentListing.gradingCompany));
            }
          } else {
            gradingConstraints.push(where('isGraded', '==', false));
          }
          
          const gradingQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            ...gradingConstraints,
            where(documentId(), '!=', currentListing.id),
            limit(maxListings - results.length)
          );
          
          const gradingSnapshot = await getDocs(gradingQuery);
          const gradingMatches = processQueryResults(gradingSnapshot);
          
          // Add only new listings
          const newMatches = gradingMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
        }
        
        // Tier 4: Fallback to same game category if we still don't have enough
        if (results.length < maxListings) {
          const fallbackQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            where(documentId(), '!=', currentListing.id),
            orderBy('createdAt', 'desc'),
            limit(maxListings - results.length)
          );
          
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const fallbackMatches = processQueryResults(fallbackSnapshot);
          
          // Add only new listings
          const newMatches = fallbackMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
        }
        
        // Tier 5: Last resort - get any active listings from any game if we still don't have enough
        if (results.length < 3) {
          const lastResortQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where(documentId(), '!=', currentListing.id),
            orderBy('createdAt', 'desc'),
            limit(maxListings - results.length)
          );
          
          const lastResortSnapshot = await getDocs(lastResortQuery);
          const lastResortMatches = processQueryResults(lastResortSnapshot);
          
          // Add only new listings
          const newMatches = lastResortMatches.filter(
            match => !results.some(existing => existing.id === match.id)
          );
          results = [...results, ...newMatches];
        }
        
        // Sort results by relevance score
        results = sortByRelevance(results, currentListing);
        
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
      
      // Same game is highest priority
      if (a.game === currentListing.game) scoreA += 100;
      if (b.game === currentListing.game) scoreB += 100;
      
      // Same card name is very important
      if (a.cardName && currentListing.cardName && 
          a.cardName.toLowerCase() === currentListing.cardName.toLowerCase()) scoreA += 80;
      if (b.cardName && currentListing.cardName && 
          b.cardName.toLowerCase() === currentListing.cardName.toLowerCase()) scoreB += 80;
      
      // Similar condition
      if (a.condition === currentListing.condition) scoreA += 40;
      if (b.condition === currentListing.condition) scoreB += 40;
      
      // Similar grading status
      if (a.isGraded === currentListing.isGraded) scoreA += 30;
      if (b.isGraded === currentListing.isGraded) scoreB += 30;
      
      // Same grading company
      if (a.gradingCompany && currentListing.gradingCompany && 
          a.gradingCompany === currentListing.gradingCompany) scoreA += 20;
      if (b.gradingCompany && currentListing.gradingCompany && 
          b.gradingCompany === currentListing.gradingCompany) scoreB += 20;
      
      // Similar price (within 20%)
      const priceRangeA = Math.abs(a.price - currentListing.price) / currentListing.price;
      const priceRangeB = Math.abs(b.price - currentListing.price) / currentListing.price;
      if (priceRangeA <= 0.2) scoreA += 20;
      if (priceRangeB <= 0.2) scoreB += 20;
      
      // Newer listings get a small boost
      const ageA = new Date().getTime() - a.createdAt.getTime();
      const ageB = new Date().getTime() - b.createdAt.getTime();
      if (ageA < ageB) scoreA += 5;
      if (ageB < ageA) scoreB += 5;
      
      return scoreB - scoreA;
    });
  };

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