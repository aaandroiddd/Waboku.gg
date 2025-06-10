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

interface OwnerListingsProps {
  ownerId: string;
  currentListingId: string;
  maxListings?: number;
  ownerName?: string;
}

export const OwnerListings = ({ ownerId, currentListingId, maxListings = 8, ownerName = "Seller" }: OwnerListingsProps) => {
  const [ownerListings, setOwnerListings] = useState<Listing[]>([]);
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
  const fetchOwnerListings = useCallback(async () => {
    if (!ownerId || !currentListingId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log(`[OwnerListings] Fetching listings for owner: ${ownerId} (attempt ${retryCount + 1})`);
      
      const { db } = getFirebaseServices();
      if (!db) throw new Error('Firebase DB not initialized');

      // Create a unique ID for this query
      const listenerId = `owner-listings-${ownerId}-${currentListingId}-${retryCount}`;
      
      // Query for active listings by this owner, excluding the current listing
      const ownerQuery = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('userId', '==', ownerId),
        where(documentId(), '!=', currentListingId),
        limit(maxListings)
      );
      
      // First try a regular query to see if we can get data
      try {
        console.log('[OwnerListings] Attempting direct query first');
        const querySnapshot = await getDocs(ownerQuery);
        
        if (!querySnapshot.empty) {
          console.log(`[OwnerListings] Direct query successful, found ${querySnapshot.docs.length} listings`);
          
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
          
          setOwnerListings(sortedResults);
          setIsLoading(false);
          fetchedRef.current = true;
          return; // Exit early if direct query works
        } else {
          console.log('[OwnerListings] Direct query returned no results, falling back to listener');
        }
      } catch (directQueryError) {
        console.error('[OwnerListings] Direct query failed, falling back to listener:', directQueryError);
      }
      
      // Register the listener with the connection manager
      registerListener(listenerId, ownerQuery, (snapshot) => {
        console.log(`[OwnerListings] Listener received data with ${snapshot.docs.length} listings`);
        
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
        
        setOwnerListings(sortedResults);
        setIsLoading(false);
        fetchedRef.current = true;
      }, (error) => {
        console.error('[OwnerListings] Error in listener:', error);
        setError(`Failed to load seller's listings: ${error.message}`);
        setIsLoading(false);
        
        // If we haven't exceeded max retries, try again
        if (retryCount < maxRetries) {
          console.log(`[OwnerListings] Retry ${retryCount + 1}/${maxRetries} in 2 seconds...`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000);
        }
      });
      
    } catch (error) {
      console.error('[OwnerListings] Error setting up query:', error);
      setError(`Error setting up query: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        console.log(`[OwnerListings] Retry ${retryCount + 1}/${maxRetries} in 2 seconds...`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 2000);
      }
    }
  }, [ownerId, currentListingId, maxListings, retryCount]);

  // Effect to trigger fetch when component mounts or retry count changes
  useEffect(() => {
    if (!fetchedRef.current || retryCount > 0) {
      fetchOwnerListings();
    }
    
    // Cleanup function
    return () => {
      if (ownerId && currentListingId) {
        const cleanupId = `owner-listings-${ownerId}-${currentListingId}`;
        removeListenersByPrefix(cleanupId);
      }
    };
  }, [ownerId, currentListingId, fetchOwnerListings, retryCount]);

  // Function to manually retry loading
  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
  };

  // Function to fix Firestore Listen channel issues
  const handleFixListenChannel = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[OwnerListings] Attempting to fix Firestore Listen channel...');
      const result = await fixFirestoreListenChannel();
      
      if (result.success) {
        console.log('[OwnerListings] Listen channel fix successful, retrying fetch...');
        // Reset retry count and try again
        setRetryCount(0);
        fetchedRef.current = false;
        setTimeout(() => {
          fetchOwnerListings();
        }, 1000);
      } else {
        console.error('[OwnerListings] Listen channel fix failed:', result.message);
        setError(`Listen channel fix failed: ${result.message}`);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[OwnerListings] Error fixing Listen channel:', error);
      setError(`Error fixing Listen channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">More from {ownerName}</h2>
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
          <h2 className="text-2xl font-bold">More from {ownerName}</h2>
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

  if (ownerListings.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">More from {ownerName}</h2>
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/profile/${ownerId}`)} 
          className="flex items-center"
        >
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      <Carousel className="w-full relative" setApi={setApi}>
        <CarouselContent className="-ml-4">
          {ownerListings.map((listing) => (
            <CarouselItem key={`owner-${listing.id}`} className="pl-4 md:basis-1/4 lg:basis-1/4">
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
        <CarouselPrevious className="hidden md:flex h-8 w-8" />
        <CarouselNext className="hidden md:flex h-8 w-8" />
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