import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Listing } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/ListingCard';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { ArrowRight } from 'lucide-react';

// Global cache for similar listings to prevent repeated fetches across page views
const similarListingsCache: Record<string, {
  listings: Listing[],
  timestamp: number
}> = {};

// Cache expiration time (15 minutes)
const CACHE_EXPIRATION = 15 * 60 * 1000;

// Function to get condition color for ListingCard
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

interface SimilarListingsProps {
  currentListing: Listing;
  maxListings?: number;
}

export const SimilarListings: React.FC<SimilarListingsProps> = React.memo(({ 
  currentListing, 
  maxListings = 3 
}) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use hooks directly at the top level
  const { toggleFavorite, isFavorite } = useFavorites();
  
  const router = useRouter();
  
  // Track fetch status
  const hasInitializedRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  // Generate a stable cache key
  const cacheKey = useMemo(() => {
    if (!currentListing?.id) return '';
    return `similar_${currentListing.id}_${maxListings}`;
  }, [currentListing?.id, maxListings]);
  
  // Use separate function for fetching to improve readability
  const fetchSimilarListings = async () => {
    // Skip if already fetching or no listing
    if (isFetchingRef.current || !currentListing?.id || !cacheKey) {
      return;
    }
    
    console.log(`[SimilarListings] Fetching data for listing ${currentListing.id}`);
    isFetchingRef.current = true;
    setIsLoading(true);
    
    try {
      // Check cache first
      if (similarListingsCache[cacheKey]) {
        const cachedData = similarListingsCache[cacheKey];
        const now = Date.now();
        
        if (now - cachedData.timestamp < CACHE_EXPIRATION) {
          console.log(`[SimilarListings] Using cached data for ${cacheKey}`);
          setSimilarListings(cachedData.listings);
          setIsLoading(false);
          isFetchingRef.current = false;
          return;
        }
      }
      
      // Get Firebase instance
      const { db } = await getFirebaseServices();
      if (!db) {
        console.error('[SimilarListings] Firebase db not available');
        setIsLoading(false);
        isFetchingRef.current = false;
        return;
      }
      
      const listingsRef = collection(db, 'listings');
      let gameSpecificResults: Listing[] = [];
      
      // Try game-specific query if applicable
      if (currentListing.game && currentListing.game !== 'other') {
        try {
          const gameQuery = query(
            listingsRef,
            where('status', '==', 'active'),
            where('game', '==', currentListing.game),
            orderBy('createdAt', 'desc'),
            limit(20) // Reduced from original
          );
          
          const gameSnapshot = await getDocs(gameQuery);
          console.log(`[SimilarListings] Game-specific query returned ${gameSnapshot.docs.length} results`);
          
          gameSpecificResults = gameSnapshot.docs
            .filter(doc => doc.id !== currentListing.id)
            .map(doc => {
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
        } catch (error) {
          console.error('[SimilarListings] Error with game-specific query:', error);
        }
      }
      
      // If game-specific query didn't return enough results, use the general query
      let fetchedListings = gameSpecificResults;
      
      if (gameSpecificResults.length < maxListings) {
        console.log(`[SimilarListings] Game-specific query didn't return enough results, using general query`);
        
        // Use a very targeted general query
        const generalQuery = query(
          listingsRef,
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(20) // Reduced from original
        );
        
        const querySnapshot = await getDocs(generalQuery);
        console.log(`[SimilarListings] General query returned ${querySnapshot.docs.length} results`);
        
        const generalResults = querySnapshot.docs
          .filter(doc => doc.id !== currentListing.id)
          .map(doc => {
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
        
        // Combine results, ensuring no duplicates
        const existingIds = new Set(gameSpecificResults.map(l => l.id));
        const uniqueGeneralResults = generalResults.filter(l => !existingIds.has(l.id));
        
        fetchedListings = [...gameSpecificResults, ...uniqueGeneralResults];
      }
      
      // Calculate similarity scores
      const listingsWithScore = fetchedListings.map(listing => {
        let score = 0;
        
        // Same game category - highest priority
        if (listing.game === currentListing.game) {
          score += 20;
        }
        
        // Extract keywords function
        const extractKeywords = (text: string): string[] => {
          if (!text) return [];
          return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        };
        
        // Get keywords from both listings
        const currentKeywords = new Set([
          ...extractKeywords(currentListing.title),
          ...extractKeywords(currentListing.description || ''),
          ...(currentListing.cardName ? extractKeywords(currentListing.cardName) : [])
        ]);
        
        const listingKeywords = new Set([
          ...extractKeywords(listing.title),
          ...extractKeywords(listing.description || ''),
          ...(listing.cardName ? extractKeywords(listing.cardName) : [])
        ]);
        
        // Count matching keywords
        let matchingKeywords = 0;
        currentKeywords.forEach(keyword => {
          if (listingKeywords.has(keyword)) {
            matchingKeywords++;
          }
        });
        
        score += matchingKeywords * 2;
        
        // Card name similarity
        if (listing.cardName && currentListing.cardName) {
          const listingCardName = listing.cardName.toLowerCase();
          const currentCardName = currentListing.cardName.toLowerCase();
          
          if (listingCardName === currentCardName) {
            score += 15;
          } 
          else if (listingCardName.includes(currentCardName) || 
                   currentCardName.includes(listingCardName)) {
            score += 10;
          }
        }
        
        // Similar condition
        if (listing.condition === currentListing.condition) {
          score += 3;
        }
        
        // Similar price range
        if (listing.price && currentListing.price) {
          const priceDiff = Math.abs(listing.price - currentListing.price);
          const pricePercentDiff = currentListing.price > 0 ? 
            (priceDiff / currentListing.price) * 100 : 100;
          if (pricePercentDiff <= 20) {
            score += 2;
          }
        }
        
        return { listing, score };
      });
      
      // Sort by similarity score (highest first)
      listingsWithScore.sort((a, b) => b.score - a.score);
      
      // Take the top N listings
      const topSimilarListings = listingsWithScore
        .slice(0, maxListings)
        .map(item => item.listing);
      
      console.log(`[SimilarListings] Found ${topSimilarListings.length} similar listings`);
      
      // Update state with results
      setSimilarListings(topSimilarListings);
      
      // Cache the results
      similarListingsCache[cacheKey] = {
        listings: topSimilarListings,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('[SimilarListings] Error fetching similar listings:', error);
      setSimilarListings([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };
  
  // Handle initial fetch on mount
  useEffect(() => {
    console.log('[SimilarListings] Component mounted, initializing...');
    
    if (!hasInitializedRef.current && currentListing?.id && cacheKey) {
      hasInitializedRef.current = true;
      fetchSimilarListings();
    }
    
    return () => {
      console.log('[SimilarListings] Component unmounting, cleaning up...');
      hasInitializedRef.current = false;
      isFetchingRef.current = false;
    };
  }, []);
  
  // Handle refetch if cache key changes
  useEffect(() => {
    if (hasInitializedRef.current && currentListing?.id && cacheKey) {
      console.log(`[SimilarListings] Cache key changed to ${cacheKey}, fetching data...`);
      fetchSimilarListings();
    }
  }, [cacheKey]);
  
  // Handle navigation to view all listings
  const handleViewAll = () => {
    router.push(`/listings?game=${currentListing.game}`);
  };
  
  // Render the component
  return (
    <Card className="bg-black/[0.2] dark:bg-black/40 backdrop-blur-md border-muted mt-8">
      <CardHeader>
        <CardTitle className="text-xl">Similar Listings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[350px]">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(maxListings)].map((_, i) => (
                <div key={i} className="h-[300px] bg-muted/50 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : similarListings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {similarListings.map(listing => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isFavorite={isFavorite(listing.id)}
                    onFavoriteClick={(e, listing) => toggleFavorite(listing, e)}
                    getConditionColor={getConditionColor}
                  />
                ))}
              </div>
              <div className="mt-6 text-center">
                <Button 
                  variant="outline" 
                  onClick={handleViewAll}
                  className="group"
                >
                  View All Similar Listings
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-8 w-8 text-muted-foreground" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">Looking for similar items?</h3>
                <p className="text-muted-foreground mb-4">
                  We're still building our collection of {currentListing.game} listings.
                  <br />Check back soon or browse all available listings.
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleViewAll}
                className="group"
              >
                Browse All {currentListing.game} Listings
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// Add display name for better debugging
SimilarListings.displayName = 'SimilarListings';
