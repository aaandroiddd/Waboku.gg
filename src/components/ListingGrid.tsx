import { Card, CardContent } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Listing } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useMemo, memo } from 'react';
import { RemoveFavoriteDialog } from './RemoveFavoriteDialog';
import { Button } from '@/components/ui/button';
import { ListingCard } from './ListingCard';
import { useListings } from '@/hooks/useListings';

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
    base: 'bg-[#e51f1f]/10 text-[#e51f1f]',
    hover: 'hover:bg-[#e51f1f]/20'
  },
  'played': {
    base: 'bg-[#e85f2a]/10 text-[#e85f2a]',
    hover: 'hover:bg-[#e85f2a]/20'
  },
  'light played': {
    base: 'bg-[#f2a134]/10 text-[#f2a134]',
    hover: 'hover:bg-[#f2a134]/20'
  },
  'light-played': {
    base: 'bg-[#f2a134]/10 text-[#f2a134]',
    hover: 'hover:bg-[#f2a134]/20'
  },
  'good': {
    base: 'bg-[#f2a134]/10 text-[#f2a134]',
    hover: 'hover:bg-[#f2a134]/20'
  },
  'excellent': {
    base: 'bg-[#f7e379]/10 text-[#f7e379]',
    hover: 'hover:bg-[#f7e379]/20'
  },
  'near mint': {
    base: 'bg-[#bbdb44]/10 text-[#bbdb44]',
    hover: 'hover:bg-[#bbdb44]/20'
  },
  'near-mint': {
    base: 'bg-[#bbdb44]/10 text-[#bbdb44]',
    hover: 'hover:bg-[#bbdb44]/20'
  },
  'mint': {
    base: 'bg-[#44ce1b]/10 text-[#44ce1b]',
    hover: 'hover:bg-[#44ce1b]/20'
  }
};

const defaultColor = { base: 'bg-gray-500/10 text-gray-500', hover: 'hover:bg-gray-500/20' };

// Memoize the condition color function
const getConditionColor = (condition: string): { base: string; hover: string } => {
  return conditionColors[condition?.toLowerCase()] || defaultColor;
};

// Memoize the loading skeleton
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
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
  const { latitude, longitude } = useGeolocation();
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

  const handleFavoriteClick = useCallback((e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      window.location.href = '/auth/sign-in';
      return;
    }

    if (isFavorite(listing.id)) {
      setSelectedListing(listing);
      setIsDialogOpen(true);
    } else {
      toggleFavorite(listing);
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

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Check if we have any listings after filtering
  const hasListings = displayedListings.length > 0;
  
  if (!hasListings) {
    return <EmptyState />;
  }

  return (
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
    </div>
  );
}