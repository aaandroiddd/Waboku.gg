import { Card, CardContent } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Listing } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useMemo } from 'react';
import { RemoveFavoriteDialog } from './RemoveFavoriteDialog';
import { Button } from '@/components/ui/button';
import { ListingCard } from './ListingCard';

interface ListingGridProps {
  listings?: Listing[];
  userId?: string;
  showOnlyActive?: boolean;
  displayCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
}

const getConditionColor = (condition: string): { base: string; hover: string } => {
  const colors: Record<string, { base: string; hover: string }> = {
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
  return colors[condition?.toLowerCase()] || { base: 'bg-gray-500/10 text-gray-500', hover: 'hover:bg-gray-500/20' };
};

export function ListingGrid({ 
  listings: propListings,
  userId,
  showOnlyActive = false,
  displayCount,
  hasMore,
  onLoadMore,
  loading: propLoading
}: ListingGridProps) {
  const listings = propListings || [];
  const loading = propLoading;
  
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
    return listings.slice(0, displayCount);
  }, [listings, displayCount]);

  if (loading) {
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
  }

  if (!listings?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">No listings found.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        <AnimatePresence>
          {displayedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isFavorite={user ? isFavorite(listing.id) : false}
              onFavoriteClick={handleFavoriteClick}
              getConditionColor={getConditionColor}
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