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
        // 1. Same game category
        // 2. Active status
        // 3. Not the current listing
        // 4. Not from the same seller
        const listingsRef = collection(db, 'listings');
        
        // Base query constraints
        const baseConstraints = [
          where('status', '==', 'active'),
          where('game', '==', currentListing.game),
          orderBy('createdAt', 'desc'),
          limit(20) // Fetch more than we need to filter
        ];
        
        const q = query(listingsRef, ...baseConstraints);
        const querySnapshot = await getDocs(q);
        
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
          // Filter out the current listing and listings from the same seller
          .filter(listing => 
            listing.id !== currentListing.id && 
            listing.userId !== currentListing.userId
          );
        
        // Calculate similarity score for each listing
        const listingsWithScore = fetchedListings.map(listing => {
          let score = 0;
          
          // Same game category (already filtered in query)
          score += 5;
          
          // Similar condition
          if (listing.condition === currentListing.condition) {
            score += 3;
          }
          
          // Similar price range (within 20% of current listing price)
          const priceDiff = Math.abs(listing.price - currentListing.price);
          const pricePercentDiff = (priceDiff / currentListing.price) * 100;
          if (pricePercentDiff <= 20) {
            score += 3;
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
          
          // Similar card name if available
          if (listing.cardName && currentListing.cardName) {
            if (listing.cardName.toLowerCase().includes(currentListing.cardName.toLowerCase()) ||
                currentListing.cardName.toLowerCase().includes(listing.cardName.toLowerCase())) {
              score += 4;
            }
          }
          
          // Title similarity (check if titles share words)
          const currentTitleWords = currentListing.title.toLowerCase().split(/\s+/);
          const listingTitleWords = listing.title.toLowerCase().split(/\s+/);
          const sharedWords = currentTitleWords.filter(word => 
            word.length > 3 && listingTitleWords.includes(word)
          );
          score += sharedWords.length * 1;
          
          return { listing, score };
        });
        
        // Sort by similarity score (highest first)
        listingsWithScore.sort((a, b) => b.score - a.score);
        
        // Take the top N listings
        const topSimilarListings = listingsWithScore
          .slice(0, maxListings)
          .map(item => item.listing);
        
        setSimilarListings(topSimilarListings);
      } catch (error) {
        console.error('Error fetching similar listings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilarListings();
  }, [currentListing, maxListings]);

  // Don't render anything if no similar listings found
  if (!isLoading && similarListings.length === 0) {
    return null;
  }

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
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
};