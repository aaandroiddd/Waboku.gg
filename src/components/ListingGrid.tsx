import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { Listing } from '@/types/database';

interface ListingGridProps {
  listings: Listing[];
  loading?: boolean;
  displayCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  userId?: string;
}

export function ListingGrid({ 
  listings, 
  loading, 
  displayCount = listings?.length, 
  hasMore, 
  onLoadMore,
  userId 
}: ListingGridProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="aspect-square bg-secondary rounded-lg mb-2" />
              <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
              <div className="h-4 bg-secondary rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!listings?.length) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-muted-foreground">No listings found.</p>
        </CardContent>
      </Card>
    );
  }

  const displayedListings = listings.slice(0, displayCount);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayedListings.map((listing) => (
          <Card key={listing.id} className="relative">
            <Link href={`/listings/${listing.id}`}>
              <CardContent className="p-4">
                <div className="aspect-square bg-muted rounded-lg mb-4">
                  {listing.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}
                </div>
                <h3 className="font-semibold truncate">{listing.title}</h3>
                <p className="text-muted-foreground">${listing.price}</p>
                <p className="text-sm text-muted-foreground mt-2">{listing.condition}</p>
              </CardContent>
            </Link>
            {user && (
              <CardFooter className="p-4 pt-0 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(listing);
                  }}
                  className={isFavorite(listing.id) ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'}
                >
                  <Heart className={`h-5 w-5 ${isFavorite(listing.id) ? 'fill-current' : ''}`} />
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button onClick={onLoadMore} variant="outline">
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}