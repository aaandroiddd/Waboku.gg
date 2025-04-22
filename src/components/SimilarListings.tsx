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

// Add type declaration for window.__similarListingsFetched
declare global {
  interface Window {
    __similarListingsFetched?: Record<string, boolean>;
  }
}

interface SimilarListingsProps {
  currentListing: Listing;
  maxListings?: number;
}

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

// Global cache for similar listings to prevent repeated fetches across page views
const similarListingsCache: Record<string, {
  listings: Listing[],
  timestamp: number
}> = {};

// Cache expiration time (15 minutes)
const CACHE_EXPIRATION = 15 * 60 * 1000;

export const SimilarListings: React.FC<SimilarListingsProps> = ({ 
  currentListing, 
  maxListings = 3 
}) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleFavorite, isFavorite } = useFavorites();
  const router = useRouter();
  
  // Use a single ref to track data fetching state
  const dataFetchedRef = useRef(false);
  
  // Generate a stable cache key for this listing
  const cacheKey = useMemo(() => 
    currentListing?.id ? `similar_${currentListing.id}` : null, 
    [currentListing?.id]
  );
  
  // Single effect for data fetching with proper dependency tracking
  useEffect(() => {
    // Skip if no listing
    if (!currentListing?.id || !cacheKey) {
      return;
    }
    
    // For debugging - always fetch data to diagnose the issue
    console.log(`[SimilarListings] Fetching data for listing ${currentListing.id} with game ${currentListing.game}`);
    
    // Reset the fetched flag to force a new fetch
    if (typeof window !== 'undefined') {
      window.__similarListingsFetched = window.__similarListingsFetched || {};
      // Clear the fetched flag for this listing to force a new fetch
      delete window.__similarListingsFetched[cacheKey];
    }
    
    // Clear cache for this listing to force a new fetch
    if (cacheKey && similarListingsCache[cacheKey]) {
      delete similarListingsCache[cacheKey];
    }
    
    // Mark as fetched immediately to prevent duplicate requests during this component instance
    dataFetchedRef.current = true;
    
    // Set loading state
    setIsLoading(true);
    
    // Define the fetch function
    const fetchSimilarListings = async () => {
      try {
        console.log(`[SimilarListings] Fetching similar listings for ${currentListing.id}`);
        const { db } = await getFirebaseServices();
        
        // Skip if db is not available
        if (!db) {
          console.error('[SimilarListings] Firebase db not available');
          setIsLoading(false);
          return;
        }
        
        const listingsRef = collection(db, 'listings');
        
        // First try a simple query to see if we get any results at all
        const testQuery = query(
          listingsRef,
          where('status', '==', 'active'),
          limit(5)
        );
        
        const testSnapshot = await getDocs(testQuery);
        console.log(`[SimilarListings] Test query returned ${testSnapshot.docs.length} results`);
        
        // Create a more targeted query to reduce data transfer
        const baseConstraints = [
          where('status', '==', 'active'), // Only get active listings
          orderBy('createdAt', 'desc'),
          limit(50) // Increased to ensure we get enough results
        ];
        
        // If we know the game, filter by it to get more relevant results
        let q;
        let gameSpecificResults = [];
        
        // Try game-specific query first if applicable
        if (currentListing.game && currentListing.game !== 'other') {
          try {
            const gameQuery = query(
              listingsRef,
              where('status', '==', 'active'),
              where('game', '==', currentListing.game),
              orderBy('createdAt', 'desc'),
              limit(50)
            );
            
            const gameSnapshot = await getDocs(gameQuery);
            console.log(`[SimilarListings] Game-specific query returned ${gameSnapshot.docs.length} results for game ${currentListing.game}`);
            
            gameSpecificResults = gameSnapshot.docs
              .filter(doc => doc.id !== currentListing.id) // Filter out current listing
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
          } catch (gameQueryError) {
            console.error('[SimilarListings] Error with game-specific query:', gameQueryError);
          }
        }
        
        // If game-specific query didn't return enough results, use the general query
        if (gameSpecificResults.length < maxListings) {
          console.log(`[SimilarListings] Game-specific query didn't return enough results, using general query`);
          q = query(listingsRef, ...baseConstraints);
        } else {
          // We have enough game-specific results, no need for general query
          console.log(`[SimilarListings] Using ${gameSpecificResults.length} game-specific results`);
          
          // Process these results with similarity scoring
          const listingsWithScore = gameSpecificResults.map(listing => {
            let score = 20; // Base score for same game
            
            // Add other scoring logic here (same as below)
            // ...
            
            return { listing, score: 20 }; // Default high score for game matches
          });
          
          // Sort by similarity score (highest first)
          listingsWithScore.sort((a, b) => b.score - a.score);
          
          // Take the top N listings
          const topSimilarListings = listingsWithScore
            .slice(0, maxListings)
            .map(item => item.listing);
          
          // Store results
          setSimilarListings(topSimilarListings);
          
          // Cache the results
          if (cacheKey) {
            similarListingsCache[cacheKey] = {
              listings: topSimilarListings,
              timestamp: Date.now()
            };
          }
          
          setIsLoading(false);
          return; // Exit early since we have enough results
        }
        
        // Use a direct one-time fetch instead of a listener
        const querySnapshot = await getDocs(q);
        console.log(`[SimilarListings] General query returned ${querySnapshot.docs.length} results`);
        
        // Process results
        let fetchedListings = querySnapshot.docs
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
          })
          // Filter out current listing and non-active listings
          .filter(listing => {
            const isCurrentListing = listing.id === currentListing.id;
            const isActive = listing.status === 'active';
            return !isCurrentListing && isActive;
          });
        
        // Combine with game-specific results if we have any
        if (gameSpecificResults.length > 0) {
          // Add game-specific results that aren't already in fetchedListings
          const existingIds = new Set(fetchedListings.map(l => l.id));
          const uniqueGameResults = gameSpecificResults.filter(l => !existingIds.has(l.id));
          fetchedListings = [...fetchedListings, ...uniqueGameResults];
          console.log(`[SimilarListings] Combined ${fetchedListings.length} listings from both queries`);
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
            else {
              const listingCardWords = listingCardName.split(/\s+/);
              const currentCardWords = currentCardName.split(/\s+/);
              
              const sharedCardWords = listingCardWords.filter(word => 
                word.length > 2 && currentCardWords.includes(word)
              );
              
              score += sharedCardWords.length * 3;
            }
          }
          
          // Title similarity
          if (currentListing.title && listing.title) {
            const currentTitleWords = currentListing.title.toLowerCase().split(/\s+/);
            const listingTitleWords = listing.title.toLowerCase().split(/\s+/);
            
            // Check for exact phrases
            for (let i = 0; i < currentTitleWords.length - 1; i++) {
              const phrase = `${currentTitleWords[i]} ${currentTitleWords[i+1]}`;
              if (listing.title.toLowerCase().includes(phrase)) {
                score += 5;
              }
            }
            
            // Individual word matches
            const sharedTitleWords = currentTitleWords.filter(word => 
              word.length > 2 && listingTitleWords.includes(word)
            );
            score += sharedTitleWords.length * 2;
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
          
          // Grading similarity
          if (listing.isGraded === currentListing.isGraded) {
            score += 2;
            
            if (listing.isGraded && currentListing.isGraded) {
              if (listing.gradingCompany === currentListing.gradingCompany) {
                score += 2;
              }
              
              if (listing.gradeLevel && currentListing.gradeLevel) {
                const gradeDiff = Math.abs(listing.gradeLevel - currentListing.gradeLevel);
                if (gradeDiff <= 1) {
                  score += 2;
                }
              }
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
        
        // Store results
        setSimilarListings(topSimilarListings);
        
        // Cache the results
        if (cacheKey) {
          similarListingsCache[cacheKey] = {
            listings: topSimilarListings,
            timestamp: Date.now()
          };
          console.log(`[SimilarListings] Cached ${topSimilarListings.length} listings for ${cacheKey}`);
        }
      } catch (error) {
        console.error('Error fetching similar listings:', error);
        setSimilarListings([]);
      } finally {
        setIsLoading(false);
        dataFetchedRef.current = true;
      }
    };

    // Execute fetch
    fetchSimilarListings();
    
    // No need to reset dataFetchedRef on cleanup as we want to prevent refetching
    // even if the component re-renders without being fully unmounted/remounted
  }, [currentListing?.id, cacheKey]);

  // Always render the component, even when no similar listings are found

  const handleViewAll = () => {
    // Navigate to listings page with game filter
    router.push(`/listings?game=${currentListing.game}`);
  };

  // Calculate a fixed height for the container to prevent layout shifts
  const containerHeight = 450; // Height of card + padding + header
  const cardHeight = 300; // Fixed height for listing cards

  return (
    <Card className="bg-black/[0.2] dark:bg-black/40 backdrop-blur-md border-muted mt-8">
      <CardHeader>
        <CardTitle className="text-xl">Similar Listings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[350px]"> {/* Fixed minimum height container to prevent layout shifts */}
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
};