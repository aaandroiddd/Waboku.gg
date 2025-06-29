import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { EmptyStateCard } from './EmptyStateCard';
import { ContentLoader } from './ContentLoader';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';

interface ListingGridWithAnalyticsProps {
  listings: Listing[];
  loading?: boolean;
  searchTerm?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function ListingGridWithAnalytics({ 
  listings, 
  loading = false, 
  searchTerm,
  hasMore = false,
  onLoadMore
}: ListingGridWithAnalyticsProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();
  const { saveRedirectState } = useAuthRedirect();
  const router = useRouter();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll implementation
  useEffect(() => {
    if (!hasMore || !onLoadMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !isLoadingMore) {
          handleLoadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [hasMore, onLoadMore, loading, isLoadingMore]);

  const handleLoadMore = async () => {
    if (!onLoadMore || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } catch (error) {
      console.error('Error loading more listings:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getConditionColor = (condition: string) => {
    const conditionColors: { [key: string]: { base: string; hover: string } } = {
      'mint': { base: 'bg-green-100 text-green-800 border-green-200', hover: 'hover:bg-green-200' },
      'near-mint': { base: 'bg-green-50 text-green-700 border-green-100', hover: 'hover:bg-green-100' },
      'excellent': { base: 'bg-blue-100 text-blue-800 border-blue-200', hover: 'hover:bg-blue-200' },
      'good': { base: 'bg-yellow-100 text-yellow-800 border-yellow-200', hover: 'hover:bg-yellow-200' },
      'light-played': { base: 'bg-orange-100 text-orange-800 border-orange-200', hover: 'hover:bg-orange-200' },
      'played': { base: 'bg-red-100 text-red-800 border-red-200', hover: 'hover:bg-red-200' },
      'poor': { base: 'bg-gray-100 text-gray-800 border-gray-200', hover: 'hover:bg-gray-200' },
    };
    return conditionColors[condition?.toLowerCase()] || conditionColors['good'];
  };

  const handleFavoriteClick = async (e: React.MouseEvent, listing: Listing) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      // Save the current action before redirecting
      saveRedirectState('favorite', { listingId: listing.id });
      router.push('/auth/sign-in');
      return;
    }

    await toggleFavorite(listing, e);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <ContentLoader key={index} className="h-[420px]" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <EmptyStateCard
        title="No listings found"
        description={searchTerm ? 
          `No listings match your search for "${searchTerm}". Try adjusting your filters or search terms.` :
          "No listings are currently available. Check back later for new items!"
        }
        actionText="Browse All Listings"
        actionHref="/listings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {listings.map((listing, index) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isFavorite={user ? isFavorite(listing.id) : false}
            onFavoriteClick={handleFavoriteClick}
            getConditionColor={getConditionColor}
            searchTerm={searchTerm}
            resultPosition={index + 1}
          />
        ))}
      </div>

      {/* Infinite scroll trigger and load more button */}
      {hasMore && (
        <div className="flex flex-col items-center space-y-4">
          {/* Intersection observer target for infinite scroll */}
          <div ref={observerRef} className="h-4" />
          
          {/* Manual load more button */}
          <Button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            variant="outline"
            className="min-w-[200px]"
          >
            {isLoadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                Loading more...
              </>
            ) : (
              'Load More Listings'
            )}
          </Button>
        </div>
      )}

      {/* Loading indicator for additional items */}
      {isLoadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <ContentLoader key={`loading-${index}`} className="h-[420px]" />
          ))}
        </div>
      )}
    </div>
  );
}