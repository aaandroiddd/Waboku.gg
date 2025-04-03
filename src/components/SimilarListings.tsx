import React, { useEffect, useState } from 'react';
import { Listing } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/ListingCard';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ArrowRight } from 'lucide-react';

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

export const SimilarListings: React.FC<SimilarListingsProps> = ({ 
  currentListing, 
  maxListings = 3 
}) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleFavorite, isFavorite } = useFavorites();
  const router = useRouter();

  useEffect(() => {
    const fetchSimilarListings = async () => {
      if (!currentListing) return;
      
      try {
        setIsLoading(true);
        const { db } = await getFirebaseServices();
        
        // Create a query to find similar listings based on:
        // 1. Active status
        // 2. Not the current listing
        // 3. Not from the same seller
        // 4. Same game category if possible, but don't restrict too much
        const listingsRef = collection(db, 'listings');
        
        // Log the current listing details for debugging
        console.log('Current listing details:', {
          id: currentListing.id,
          game: currentListing.game,
          cardName: currentListing.cardName,
          title: currentListing.title
        });
        
        // Log that we're filtering out archived and inactive listings
        console.log('Filtering out archived and inactive listings from similar listings results');
        
        // First try: Query with game category filter but without status filter
        // This is a temporary fix to ensure we get some listings
        let baseConstraints = [
          orderBy('createdAt', 'desc'),
          limit(30) // Fetch more than we need to have a good pool for filtering
        ];
        
        let q = query(listingsRef, ...baseConstraints);
        let querySnapshot = await getDocs(q);
        console.log(`Found ${querySnapshot.docs.length} listings with general query without status filter.`);
        
        // If we still don't have enough results, try an even more general query
        if (querySnapshot.docs.length < 5) {
          console.log(`Found only ${querySnapshot.docs.length} listings. Trying even more general query.`);
          
          // Second try: Query with increased limit
          baseConstraints = [
            orderBy('createdAt', 'desc'),
            limit(100) // Significantly increase limit to find any listings
          ];
          
          q = query(listingsRef, ...baseConstraints);
          querySnapshot = await getDocs(q);
          console.log(`Found ${querySnapshot.docs.length} listings with expanded general query.`);
        }
        
        // Process the results
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
          // Filter out the current listing, archived, and inactive listings
          .filter(listing => {
            const isCurrentListing = listing.id === currentListing.id;
            const isArchived = listing.status === 'archived';
            const isInactive = listing.status === 'inactive';
            
            // Log filtered out listings for debugging
            if (isArchived || isInactive) {
              console.log(`Filtering out listing ${listing.id} with status: ${listing.status}`);
            }
            
            return !isCurrentListing && !isArchived && !isInactive;
          });
          
        console.log(`After filtering, ${fetchedListings.length} listings remain.`);
        
        // Calculate similarity score for each listing with enhanced keyword matching
        const listingsWithScore = fetchedListings.map(listing => {
          let score = 0;
          
          // Same game category - highest priority
          if (listing.game === currentListing.game) {
            score += 20; // Give a significant boost to listings in the same game category
          }
          
          // Extract keywords from titles and descriptions for better matching
          const extractKeywords = (text: string): string[] => {
            if (!text) return [];
            // Remove special characters, convert to lowercase, and split by spaces
            return text.toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .split(/\s+/)
              .filter(word => word.length > 2); // Only keep words with 3+ characters
          };
          
          // Get keywords from both listings
          const currentKeywords = new Set([
            ...extractKeywords(currentListing.title),
            ...extractKeywords(currentListing.description),
            ...(currentListing.cardName ? extractKeywords(currentListing.cardName) : [])
          ]);
          
          const listingKeywords = new Set([
            ...extractKeywords(listing.title),
            ...extractKeywords(listing.description),
            ...(listing.cardName ? extractKeywords(listing.cardName) : [])
          ]);
          
          // Count matching keywords
          let matchingKeywords = 0;
          currentKeywords.forEach(keyword => {
            if (listingKeywords.has(keyword)) {
              matchingKeywords++;
            }
          });
          
          // Add score based on keyword matches (higher weight)
          score += matchingKeywords * 2;
          
          // Card name similarity (highest priority for card-specific matches)
          if (listing.cardName && currentListing.cardName) {
            const listingCardName = listing.cardName.toLowerCase();
            const currentCardName = currentListing.cardName.toLowerCase();
            
            // Exact match
            if (listingCardName === currentCardName) {
              score += 15;
            } 
            // Partial match (one contains the other)
            else if (listingCardName.includes(currentCardName) || 
                     currentCardName.includes(listingCardName)) {
              score += 10;
            }
            // Word-level match
            else {
              const listingCardWords = listingCardName.split(/\s+/);
              const currentCardWords = currentCardName.split(/\s+/);
              
              const sharedCardWords = listingCardWords.filter(word => 
                word.length > 2 && currentCardWords.includes(word)
              );
              
              score += sharedCardWords.length * 3;
            }
          }
          
          // Title similarity with improved matching
          const currentTitleWords = currentListing.title.toLowerCase().split(/\s+/);
          const listingTitleWords = listing.title.toLowerCase().split(/\s+/);
          
          // Check for exact phrases (2+ words in sequence)
          for (let i = 0; i < currentTitleWords.length - 1; i++) {
            const phrase = `${currentTitleWords[i]} ${currentTitleWords[i+1]}`;
            if (listing.title.toLowerCase().includes(phrase)) {
              score += 5; // Higher score for matching phrases
            }
          }
          
          // Individual word matches
          const sharedTitleWords = currentTitleWords.filter(word => 
            word.length > 2 && listingTitleWords.includes(word)
          );
          score += sharedTitleWords.length * 2; // Increased from 1 to emphasize title matches
          
          // Similar condition
          if (listing.condition === currentListing.condition) {
            score += 3;
          }
          
          // Similar price range (within 20% of current listing price)
          const priceDiff = Math.abs(listing.price - currentListing.price);
          const pricePercentDiff = (priceDiff / currentListing.price) * 100;
          if (pricePercentDiff <= 20) {
            score += 2; // Reduced from 3 to prioritize content matches over price
          }
          
          // Both graded or both not graded
          if (listing.isGraded === currentListing.isGraded) {
            score += 2;
          }
          
          // Similar grading if both are graded
          if (listing.isGraded && currentListing.isGraded) {
            if (listing.gradingCompany === currentListing.gradingCompany) {
              score += 2;
            }
            
            // Similar grade level (within 1 point)
            if (listing.gradeLevel && currentListing.gradeLevel) {
              const gradeDiff = Math.abs(listing.gradeLevel - currentListing.gradeLevel);
              if (gradeDiff <= 1) {
                score += 2;
              }
            }
          }
          
          return { listing, score };
        });
        
        // Sort by similarity score (highest first)
        listingsWithScore.sort((a, b) => b.score - a.score);
        
        // Log the top scoring listings for debugging
        console.log('Top scoring listings:', 
          listingsWithScore.slice(0, 5).map(item => ({
            id: item.listing.id,
            title: item.listing.title,
            game: item.listing.game,
            score: item.score
          }))
        );
        
        // Take the top N listings
        const topSimilarListings = listingsWithScore
          .slice(0, maxListings)
          .map(item => item.listing);
        
        console.log(`Final similar listings count: ${topSimilarListings.length}`);
        
        // If we still don't have any similar listings, try to get any active listings as fallback
        if (topSimilarListings.length === 0) {
          console.log('No similar listings found, fetching fallback listings');
          
          try {
            // Fallback query: Just get any listings without status filter
            const fallbackConstraints = [
              orderBy('createdAt', 'desc'),
              limit(maxListings + 10) // Get extra listings to ensure we have enough after filtering
            ];
            
            const fallbackQuery = query(listingsRef, ...fallbackConstraints);
            const fallbackSnapshot = await getDocs(fallbackQuery);
            
            console.log(`Found ${fallbackSnapshot.docs.length} fallback listings`);
            
            // Process fallback results
            const fallbackListings = fallbackSnapshot.docs
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
              // Filter out the current listing, archived, and inactive listings for fallback too
              .filter(listing => {
                const isCurrentListing = listing.id === currentListing.id;
                const isArchived = listing.status === 'archived';
                const isInactive = listing.status === 'inactive';
                
                // Log filtered out listings for debugging
                if (isArchived || isInactive) {
                  console.log(`Filtering out fallback listing ${listing.id} with status: ${listing.status}`);
                }
                
                return !isCurrentListing && !isArchived && !isInactive;
              })
              // Take only what we need
              .slice(0, maxListings);
            
            if (fallbackListings.length > 0) {
              console.log(`Using ${fallbackListings.length} fallback listings`);
              setSimilarListings(fallbackListings);
            } else {
              console.log('No fallback listings available either');
              setSimilarListings([]);
            }
          } catch (fallbackError) {
            console.error('Error fetching fallback listings:', fallbackError);
            setSimilarListings([]);
          }
        } else {
          setSimilarListings(topSimilarListings);
        }
      } catch (error) {
        console.error('Error fetching similar listings:', error);
        setSimilarListings([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilarListings();
  }, [currentListing, maxListings]);

  // Always render the component, even when no similar listings are found

  const handleViewAll = () => {
    // Navigate to listings page with game filter
    router.push(`/listings?game=${currentListing.game}`);
  };

  return (
    <Card className="bg-black/[0.2] dark:bg-black/40 backdrop-blur-md border-muted mt-8">
      <CardHeader>
        <CardTitle className="text-xl">Similar Listings</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};