import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from '@/hooks/useLocation';
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
import { ContentLoader } from './ContentLoader';
import { useLoading } from '@/contexts/LoadingContext';

interface ListingGridProps {
  listings?: Listing[];
  userId?: string;
  showOnlyActive?: boolean;
  displayCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
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
    base: 'bg-[#bbdb44]/20 text-[#bbdb44] border border-[#bbdb44]/30',
    hover: 'hover:bg-[#bbdb44]/30'
  },
  'near-mint': {
    base: 'bg-[#bbdb44]/20 text-[#bbdb44] border border-[#bbdb44]/30',
    hover: 'hover:bg-[#bbdb44]/30'
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
          <Card className="animate-pulse">
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
const EmptyState = memo(function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: isMobile ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isMobile ? 0.3 : 0.5 }}
      className="text-center"
    >
      <Card>
        <CardContent className="p-8">
          <h3 className="text-lg font-semibold mb-2">No Listings Available</h3>
          <p className="text-muted-foreground">
            There are currently no active listings. Check back later or try adjusting your search filters.
          </p>
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
  loading: propLoading = false
}: ListingGridProps) {
  const { location } = useLocation();
  // Only use useListings if no listings are provided and userId is provided
  const { listings: fetchedListings, isLoading } = useListings({ 
    userId, 
    showOnlyActive: true 
  });
  
  const listings = userId ? (propListings.length > 0 ? propListings : fetchedListings) : propListings;
  const loading = propLoading || (userId ? isLoading : false);
  
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { setLoading } = useLoading();
  
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
    console.log('Listings received:', {
      total: listings.length,
      sample: listings.slice(0, 3).map(l => ({
        id: l.id,
        title: l.title,
        status: l.status,
        expiresAt: l.expiresAt
      }))
    });
    
    return displayCount ? listings.slice(0, displayCount) : listings;
  }, [listings, displayCount]);

  const memoizedGetConditionColor = useCallback(getConditionColor, []);

  // Check if we have any listings after filtering
  const hasListings = displayedListings.length > 0;
  
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
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-fr">
              <AnimatePresence>
                {displayedListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isFavorite={user ? isFavorite(listing.id) : false}
                    onFavoriteClick={handleFavoriteClick}
                    getConditionColor={memoizedGetConditionColor}
                    distance={(listing as any).distance}
                  />
                ))}
              </AnimatePresence>
            </div>
            {hasMore && (
              <motion.div 
                className="flex justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button 
                  onClick={onLoadMore} 
                  variant="outline"
                  className="min-w-[200px]"
                >
                  Load More
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </ContentLoader>
  );
}