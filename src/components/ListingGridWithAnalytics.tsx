import { Listing } from '@/types/database';
import { ListingCard } from './ListingCard';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { EmptyStateCard } from './EmptyStateCard';
import { ContentLoader } from './ContentLoader';

interface ListingGridWithAnalyticsProps {
  listings: Listing[];
  loading?: boolean;
  searchTerm?: string;
}

export function ListingGridWithAnalytics({ 
  listings, 
  loading = false, 
  searchTerm 
}: ListingGridWithAnalyticsProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();
  const { saveRedirectState } = useAuthRedirect();
  const router = useRouter();

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
  );
}