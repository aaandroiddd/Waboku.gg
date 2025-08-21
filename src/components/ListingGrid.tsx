import { Card, CardContent } from '@/components/ui/card';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Listing } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { RemoveFavoriteDialog } from './RemoveFavoriteDialog';
import { Button } from '@/components/ui/button';
import { ListingCard } from './ListingCard';
import { useListings } from '@/hooks/useListings';
import { useListingVisibility } from '@/hooks/useListingVisibility';
import { ContentLoader } from './ContentLoader';
import { useLoading } from '@/contexts/LoadingContext';
import { useRouter } from 'next/router';
import { Plus } from 'lucide-react';

interface ListingGridProps {
  listings?: Listing[];
  userId?: string;
  showOnlyActive?: boolean;
  displayCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  isFavoritesPage?: boolean;
  viewMode?: 'default' | 'single' | 'image-only';
  enableAnonGate?: boolean;
}

// Memoize the condition color mapping
const conditionColors: Record<string, { base: string; hover: string }> = {
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

const defaultColor = { base: 'bg-gray-500/20 text-gray-500 border border-gray-500/30', hover: 'hover:bg-gray-500/30' };

// Memoize the condition color function
const getConditionColor = (condition: string): { base: string; hover: string } => {
  return conditionColors[condition?.toLowerCase()] || defaultColor;
};

// Detect if we're on a mobile device to simplify animations
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// Memoize the loading skeleton
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: isMobile ? 0.3 : 0.5, delay: isMobile ? 0 : i * 0.1 }}
        >
          <Card className="animate-pulse transform-gpu">
            <CardContent className="p-4">
              <div className="aspect-square bg-secondary rounded-lg mb-2" />
              <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
              <div className="h-4 bg-secondary rounded w-1/2" />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
});

// Memoize the empty state
const EmptyState = memo(function EmptyState({ isFavoritesPage }: { isFavoritesPage?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: isMobile ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isMobile ? 0.3 : 0.5 }}
      className="text-center"
    >
      <Card className="transform-gpu">
        <CardContent className="p-8">
          <h3 className="text-lg font-semibold mb-2">No Listings Available</h3>
          {isFavoritesPage ? (
            <p className="text-muted-foreground">
              When viewing a listing, click the favorites button to add it to this page.
            </p>
          ) : (
            <p className="text-muted-foreground">
              There are currently no active listings. Check back later or try adjusting your search filters.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

export function ListingGrid({ 
  listings: propListings = [],
  userId,
  showOnlyActive = false,
  displayCount,
  hasMore,
  onLoadMore,
  loading: propLoading = false,
  isFavoritesPage = false,
  viewMode = 'default',
  enableAnonGate = false
}: ListingGridProps) {
  // Only use useListings if no listings are provided via props
  const { listings: fetchedListings, isLoading } = useListings({ 
    userId, 
    showOnlyActive: true 
  });
  
  // Use propListings if provided, otherwise fall back to fetched listings
  const rawListings = propListings.length > 0 ? propListings : (userId ? fetchedListings : []);
  
  // Use our enhanced hook to filter listings for visibility only if we're fetching listings internally
  // If listings are passed as props (already filtered/sorted), skip additional visibility filtering
  const shouldApplyVisibilityFilter = !propListings.length && userId;
  const { visibleListings, filteredOutReasons } = useListingVisibility(shouldApplyVisibilityFilter ? rawListings : []);
  const listings = shouldApplyVisibilityFilter ? visibleListings : rawListings;
  
  // Log detailed filtering reasons in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && Object.keys(filteredOutReasons).length > 0) {
      console.log('Listings filtered out with reasons:', filteredOutReasons);
    }
  }, [filteredOutReasons]);
  
  const loading = propLoading || (propListings.length === 0 && userId ? isLoading : false);
  
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();
  const router = useRouter();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { setLoading } = useLoading();
  
  const [showAnonGate, setShowAnonGate] = useState(false);
  
  // Log listings for debugging only in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('ListingGrid received listings:', rawListings.length);
      console.log('ListingGrid visible listings:', listings.length);
      
      // Log detailed information about the first few listings for debugging
      if (rawListings.length > 0 && listings.length === 0) {
        console.log('Listings that were filtered out:', 
          rawListings.slice(0, 3).map(listing => ({
            id: listing.id,
            title: listing.title,
            status: listing.status,
            expiresAt: listing.expiresAt instanceof Date 
              ? listing.expiresAt.toISOString() 
              : String(listing.expiresAt),
            game: listing.game
          }))
        );
      }
    }
  }, [rawListings.length, listings.length]);
  
  // Handle case where we have listings but none are visible
  // This helps with the first-time visitor issue
  const [visibilityCheckDone, setVisibilityCheckDone] = useState(false);
  
  useEffect(() => {
    if (rawListings.length > 0 && listings.length === 0 && !visibilityCheckDone) {
      console.log('ListingGrid has listings but none are visible, performing one-time visibility check');
      // Only do this check once per component mount to avoid infinite loops
      setVisibilityCheckDone(true);
      
      // Perform a one-time loading state update with a short timeout
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
        
        // If we still have no visible listings after the check, log detailed information
        if (listings.length === 0) {
          console.warn('Still no visible listings after visibility check. Detailed reasons:', filteredOutReasons);
          
          // Try to clear the cache to force a fresh fetch on next page load
          try {
            if (typeof window !== 'undefined') {
              const cacheKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('listings_')
              );
              
              for (const key of cacheKeys) {
                localStorage.removeItem(key);
                console.log(`Cleared cache: ${key}`);
              }
              
              console.log('Cleared listings cache due to visibility issues');
            }
          } catch (error) {
            console.error('Error clearing cache:', error);
          }
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [rawListings.length, listings.length, visibilityCheckDone, filteredOutReasons]);
  
  // Update global loading state when our loading state changes
  useEffect(() => {
    setLoading(loading);
  }, [loading, setLoading]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      window.location.href = '/auth/sign-in';
      return;
    }

    // Check if the listing is already a favorite
    const isCurrentlyFavorite = isFavorite(listing.id);
    
    if (isCurrentlyFavorite) {
      // Show confirmation dialog before removing
      setSelectedListing(listing);
      setIsDialogOpen(true);
    } else {
      // Add to favorites directly, passing the event to prevent propagation
      try {
        toggleFavorite(listing, e);
        console.log('Successfully added to favorites:', listing.id);
      } catch (error) {
        console.error('Error adding to favorites:', error);
      }
    }
  }, [user, isFavorite, toggleFavorite]);

  const handleRemoveFavorite = useCallback(async () => {
    if (selectedListing) {
      await toggleFavorite(selectedListing);
      setIsDialogOpen(false);
      setSelectedListing(null);
      
      if (onLoadMore) {
        onLoadMore();
      }
    }
  }, [selectedListing, toggleFavorite, onLoadMore]);

  const displayedListings = useMemo(() => {
    // Only apply display count limit if specified
    if (process.env.NODE_ENV === 'development') {
      console.log('Listings received:', {
        total: listings.length,
        sample: listings.slice(0, 3).map(l => ({
          id: l.id,
          title: l.title,
          status: l.status,
          expiresAt: l.expiresAt
        }))
      });
    }
    
    return displayCount ? listings.slice(0, displayCount) : listings;
  }, [listings, displayCount]);

  const memoizedGetConditionColor = useCallback(getConditionColor, []);

  // Check if we have any listings after filtering
  const hasListings = displayedListings.length > 0;

  const handleLoadMoreClick = useCallback(() => {
    if (!onLoadMore) return;
    // If gate is disabled or user is logged in, proceed to load more
    if (!enableAnonGate || user) {
      onLoadMore();
      return;
    }
    try {
      const key = `anon_load_more_clicks:${router.pathname}`;
      const current = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem(key) || '0', 10) : 0;
      const next = current + 1;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, String(next));
      }
      if (next >= 2) {
        setShowAnonGate(true);
        return;
      }
      onLoadMore();
    } catch (e) {
      // On any error, fall back to default behavior
      onLoadMore();
    }
  }, [onLoadMore, enableAnonGate, user, router.pathname]);
  
  return (
    <ContentLoader 
      isLoading={loading} 
      loadingMessage="Loading listings..."
      minHeight="400px"
      fallback={<LoadingSkeleton />}
    >
      <div className="space-y-4 sm:space-y-8">
        <RemoveFavoriteDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedListing(null);
          }}
          onConfirm={handleRemoveFavorite}
          title={selectedListing?.title || ''}
        />
        {!hasListings ? (
          <EmptyState isFavoritesPage={isFavoritesPage} />
        ) : (
          <>
            <div
              className={`${viewMode === 'single' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'} ${viewMode === 'image-only' ? 'gap-2' : 'gap-3'} auto-rows-fr transform-gpu`}
            >
              <AnimatePresence mode="popLayout">
                {displayedListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isFavorite={user ? isFavorite(listing.id) : false}
                    onFavoriteClick={handleFavoriteClick}
                    getConditionColor={memoizedGetConditionColor}
                    imageOnly={viewMode === 'image-only'}
                  />
                ))}
              </AnimatePresence>
            </div>
            {hasMore ? (
              <motion.div 
                className="flex justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {showAnonGate ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Button 
                      onClick={() => router.push('/auth/sign-in')} 
                      className="min-w-[160px]"
                    >
                      Sign in to continue
                    </Button>
                    <Button 
                      onClick={() => router.push('/auth/sign-up')} 
                      variant="outline"
                      className="min-w-[160px]"
                    >
                      Get started
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={handleLoadMoreClick} 
                    variant="outline"
                    className="min-w-[200px]"
                  >
                    Load More
                  </Button>
                )}
              </motion.div>
            ) : (
              // Show "Create Listing" button when no more listings to load
              <motion.div 
                className="flex flex-col items-center space-y-4 py-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">You've seen all the listings!</h3>
                  <p className="text-muted-foreground">
                    Help grow the marketplace by creating your own listing.
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    if (!user) {
                      router.push('/auth/sign-in');
                    } else {
                      router.push('/dashboard/create-listing');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Listing
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </ContentLoader>
  );
}