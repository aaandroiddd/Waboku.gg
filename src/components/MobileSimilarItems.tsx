import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Listing } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Heart, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { getFirebaseServices, registerListener, removeListenersByPrefix } from '@/lib/firebase';
import { collection, query, where, limit, documentId, getDocs } from 'firebase/firestore';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/price';
import { getListingUrl } from '@/lib/listing-slug';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { UserNameLink } from '@/components/UserNameLink';
import { StripeSellerBadge } from '@/components/StripeSellerBadge';
import Image from 'next/image';
import Link from 'next/link';

interface MobileSimilarItemsProps {
  currentListing: Listing;
  maxListings?: number;
}

export const MobileSimilarItems = ({ currentListing, maxListings = 6 }: MobileSimilarItemsProps) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const fetchedRef = useRef(false);

  // Carousel API for mobile navigation
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Add favorites functionality
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();

  // Create a memoized fetch function
  const fetchSimilarListings = useCallback(async () => {
    if (!currentListing?.id || !currentListing?.game) return;
    
    try {
      setIsLoading(true);
      console.log(`[MobileSimilarItems] Fetching similar listings for game: ${currentListing.game}`);
      
      const { db } = getFirebaseServices();
      if (!db) throw new Error('Firebase DB not initialized');

      // Simple query for listings with the same game
      const gameQuery = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('game', '==', currentListing.game),
        where(documentId(), '!=', currentListing.id),
        limit(maxListings)
      );
      
      // Try a direct query first
      try {
        console.log('[MobileSimilarItems] Attempting direct query');
        const querySnapshot = await getDocs(gameQuery);
        
        if (!querySnapshot.empty) {
          console.log(`[MobileSimilarItems] Direct query successful, found ${querySnapshot.docs.length} listings`);
          
          const results = querySnapshot.docs.map(doc => {
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
              gradingCompany: data.gradingCompany || undefined,
              offersOnly: data.offersOnly === true
            };
          });
          
          // Sort by newest first
          const sortedResults = results.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          setSimilarListings(sortedResults);
          setIsLoading(false);
          fetchedRef.current = true;
          return;
        }
      } catch (directQueryError) {
        console.error('[MobileSimilarItems] Direct query failed:', directQueryError);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[MobileSimilarItems] Error fetching similar listings:', error);
      setIsLoading(false);
    }
  }, [currentListing?.id, currentListing?.game, maxListings]);

  // Effect to trigger fetch when component mounts
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchSimilarListings();
    }
    
    // Cleanup function
    return () => {
      if (currentListing?.id) {
        const cleanupId = `mobile-similar-listings-${currentListing.id}`;
        removeListenersByPrefix(cleanupId);
      }
    };
  }, [currentListing?.id, fetchSimilarListings]);

  // Update scroll state when API changes
  useEffect(() => {
    if (!api) return;

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    updateScrollState();
    api.on('select', updateScrollState);

    return () => {
      api.off('select', updateScrollState);
    };
  }, [api]);

  // Handle favorite click
  const handleFavoriteClick = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    toggleFavorite(listing, e);
  }, [user, toggleFavorite, router]);

  // Prevent carousel from resetting when interacting with listing cards
  const handleCarouselInteraction = useCallback((e: React.MouseEvent) => {
    // Don't prevent default for links and buttons
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    e.stopPropagation();
  }, []);

  const handlePrevious = useCallback(() => {
    if (api && canScrollPrev) {
      api.scrollPrev();
    }
  }, [api, canScrollPrev]);

  const handleNext = useCallback(() => {
    if (api && canScrollNext) {
      api.scrollNext();
    }
  }, [api, canScrollNext]);

  if (isLoading) {
    return (
      <div className="px-4 py-6 bg-background">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Similar Items</h2>
          <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48 animate-pulse">
              <div className="aspect-square bg-muted rounded-lg mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (similarListings.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-6 bg-background border-t border-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Similar Items</h2>
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/listings?game=${currentListing.game}`)}
          className="text-primary hover:text-primary/80 text-sm font-medium"
        >
          See all
        </Button>
      </div>
      
      <div ref={carouselRef} onMouseDown={handleCarouselInteraction}>
        <Carousel 
          className="w-full" 
          setApi={setApi}
          opts={{
            align: "start",
            loop: false,
            skipSnaps: false,
            dragFree: false,
          }}
        >
          <CarouselContent className="-ml-3">
            {similarListings.map((listing, index) => (
              <CarouselItem key={`mobile-similar-${listing.id}-${index}`} className="pl-3 basis-48">
                <div 
                  onMouseEnter={(e) => e.stopPropagation()}
                  onMouseLeave={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={getListingUrl(listing)}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        {/* Image */}
                        <div className="aspect-square relative bg-muted">
                          {listing.imageUrls && listing.imageUrls.length > 0 ? (
                            <Image
                              src={listing.imageUrls[listing.coverImageIndex || 0]}
                              alt={listing.title}
                              fill
                              className="object-cover"
                              sizes="192px"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/images/rect.png';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <span className="text-muted-foreground text-sm">No image</span>
                            </div>
                          )}
                          
                          {/* Favorite button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`absolute top-2 right-2 bg-black/50 hover:bg-black/75 rounded-full ${
                              user && isFavorite(listing.id) ? 'text-red-500' : 'text-white'
                            }`}
                            onClick={(e) => handleFavoriteClick(e, listing)}
                          >
                            <Heart 
                              className={`h-4 w-4 ${user && isFavorite(listing.id) ? 'fill-current' : ''}`}
                            />
                          </Button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-3 space-y-2">
                          <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                            {listing.title}
                          </h3>
                          
                          <div className="text-xs text-muted-foreground">
                            by <UserNameLink userId={listing.userId} initialUsername={listing.username} />
                          </div>
                          
                          <div className="flex items-center gap-1 flex-wrap">
                            {listing.game && (
                              <GameCategoryBadge 
                                game={listing.game} 
                                variant="outline" 
                                className="text-xs"
                              />
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {listing.condition}
                            </Badge>
                            <StripeSellerBadge userId={listing.userId} className="text-xs" />
                            {listing.isGraded && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {listing.gradingCompany} {listing.gradeLevel}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-lg font-bold">
                              {listing.offersOnly ? "Offers Only" : formatPrice(listing.price)}
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{listing.city}, {listing.state}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        </Carousel>
      </div>
      
      {/* Mobile navigation buttons */}
      <div className="flex justify-center gap-4 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!canScrollPrev}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!canScrollNext}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};