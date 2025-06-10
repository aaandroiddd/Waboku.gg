import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { getFirebaseServices, registerListener, removeListenersByPrefix } from '@/lib/firebase';
import { collection, query, where, limit, documentId, getDocs } from 'firebase/firestore';
import { fixFirestoreListenChannel } from '@/lib/firebase-connection-fix';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';

interface OptimizedSimilarListingsProps {
  currentListing: Listing;
  maxListings?: number;
}

export const OptimizedSimilarListings = ({ currentListing, maxListings = 8 }: OptimizedSimilarListingsProps) => {
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const fetchedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Carousel API for mobile navigation
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Add favorites functionality
  const { toggleFavorite, addFavoriteToGroup, isFavorite } = useFavorites();
  const { user } = useAuth();

  // Condition color mapping for ListingCard
  const getConditionColor = (condition: string) => {
    const colors: Record<string, { base: string; hover: string }> = {
      'poor': {
        base: 'bg-[#e51f1f]/20 text-[#e51f1f] border border-[#e51f1f]/30',
        hover: 'hover:bg-[#e51f1f]/30'
      },
      'played': {
        base: 'bg-[#e85f2a]/20 text-[#e85f2a] border border-[#e85f2a]/30',
        hover: 'hover:bg-[#e85f2a]/30'
      },
      'light played': {
        base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
        hover: 'hover:bg-[#f2a134]/30'
      },
      'light-played': {
        base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
        hover: 'hover:bg-[#f2a134]/30'
      },
      'good': {
        base: 'bg-[#f2a134]/20 text-[#f2a134] border border-[#f2a134]/30',
        hover: 'hover:bg-[#f2a134]/30'
      },
      'excellent': {
        base: 'bg-[#f7e379]/20 text-[#f7e379] border border-[#f7e379]/30',
        hover: 'hover:bg-[#f7e379]/30'
      },
      'near mint': {
        base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
        hover: 'hover:bg-[#7bce2a]/30'
      },
      'near-mint': {
        base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
        hover: 'hover:bg-[#7bce2a]/30'
      },
      'near_mint': {
        base: 'bg-[#7bce2a]/20 text-[#7bce2a] border border-[#7bce2a]/30',
        hover: 'hover:bg-[#7bce2a]/30'
      },
      'mint': {
        base: 'bg-[#44ce1b]/20 text-[#44ce1b] border border-[#44ce1b]/30',
        hover: 'hover:bg-[#44ce1b]/30'
      }
    };
    return colors[condition?.toLowerCase()] || { base: 'bg-gray-500/20 text-gray-500 border border-gray-500/30', hover: 'hover:bg-gray-500/30' };
  };

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

  // Create a memoized fetch function that we can call for initial load and retries
  const fetchSimilarListings = useCallback(async () => {
    if (!currentListing?.id || !currentListing?.game) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log(`[SimilarListings] Fetching similar listings for game: ${currentListing.game} (attempt ${retryCount + 1})`);
      
      const { db } = getFirebaseServices();
      if (!db) throw new Error('Firebase DB not initialized');

      // Create a unique ID for this query
      const listenerId = `similar-listings-${currentListing.id}-${retryCount}`;
      
      // Simple query for listings with the same game
      const gameQuery = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('game', '==', currentListing.game),
        where(documentId(), '!=', currentListing.id),
        limit(maxListings)
      );
      
      // First try a regular query to see if we can get data
      try {
        console.log('[SimilarListings] Attempting direct query first');
        const querySnapshot = await getDocs(gameQuery);
        
        if (!querySnapshot.empty) {
          console.log(`[SimilarListings] Direct query successful, found ${querySnapshot.docs.length} listings`);
          
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
          return; // Exit early if direct query works
        } else {
          console.log('[SimilarListings] Direct query returned no results, falling back to listener');
        }
      } catch (directQueryError) {
        console.error('[SimilarListings] Direct query failed, falling back to listener:', directQueryError);
      }
      
      // Register the listener with the connection manager
      registerListener(listenerId, gameQuery, (snapshot) => {
        console.log(`[SimilarListings] Listener received data with ${snapshot.docs.length} listings`);
        
        const results = snapshot.docs.map(doc => {
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
      }, (error) => {
        console.error('[SimilarListings] Error in listener:', error);
        setError(`Failed to load similar listings: ${error.message}`);
        setIsLoading(false);
        
        // If we haven't exceeded max retries, try again
        if (retryCount < maxRetries) {
          console.log(`[SimilarListings] Retry ${retryCount + 1}/${maxRetries} in 2 seconds...`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000);
        }
      });
      
    } catch (error) {
      console.error('[SimilarListings] Error setting up query:', error);
      setError(`Error setting up query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        console.log(`[SimilarListings] Retry ${retryCount + 1}/${maxRetries} in 2 seconds...`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
      }
    }
  }, [currentListing?.id, currentListing?.game, maxListings, retryCount]);

  // Effect to trigger fetch when component mounts or retry count changes
  useEffect(() => {
    if (!fetchedRef.current || retryCount > 0) {
      fetchSimilarListings();
    }
    
    // Cleanup function
    return () => {
      if (currentListing?.id) {
        const cleanupId = `similar-listings-${currentListing.id}`;
        removeListenersByPrefix(cleanupId);
      }
    };
  }, [currentListing?.id, fetchSimilarListings, retryCount]);

  // Function to manually retry loading
  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
  };

  // Function to fix Firestore Listen channel issues
  const handleFixListenChannel = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[SimilarListings] Attempting to fix Firestore Listen channel...');
      const result = await fixFirestoreListenChannel();
      
      if (result.success) {
        console.log('[SimilarListings] Listen channel fix successful, retrying fetch...');
        // Reset retry count and try again
        setRetryCount(0);
        fetchedRef.current = false;
        setTimeout(() => {
          fetchSimilarListings();
        }, 1000);
      } else {
        console.error('[SimilarListings] Listen channel fix failed:', result.message);
        setError(`Listen channel fix failed: ${result.message}`);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[SimilarListings] Error fixing Listen channel:', error);
      setError(`Error fixing Listen channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Similar Items</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="aspect-square bg-muted rounded-lg mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Similar Items</h2>
        </div>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive font-medium">{error}</p>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleFixListenChannel}
                  className="flex items-center gap-1"
                >
                  Fix Connection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (similarListings.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Similar Items</h2>
        <Button variant="ghost" onClick={() => router.push('/listings')} className="flex items-center">
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      <Carousel className="w-full" setApi={setApi}>
        <CarouselContent className="-ml-4">
          {similarListings.map((listing) => (
            <CarouselItem key={listing.id} className="pl-4 md:basis-1/4 lg:basis-1/4">
              <ListingCard
                listing={listing}
                isFavorite={user ? isFavorite(listing.id) : false}
                onFavoriteClick={handleFavoriteClick}
                onAddToGroup={(listingId, groupId) => addFavoriteToGroup(listing, groupId)}
                getConditionColor={getConditionColor}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Desktop arrows - hidden on mobile */}
        <CarouselPrevious 
          className="hidden md:flex hover:bg-background/90 active:bg-background/90 transition-colors"
          style={{ 
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
        />
        <CarouselNext 
          className="hidden md:flex hover:bg-background/90 active:bg-background/90 transition-colors"
          style={{ 
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%)';
          }}
        />
      </Carousel>
      
      {/* Mobile navigation arrows - shown only on mobile */}
      <div className="flex justify-center gap-4 mt-4 md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => api?.scrollPrev()}
          disabled={!canScrollPrev}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => api?.scrollNext()}
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