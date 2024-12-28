import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { Listing } from '@/types/database';
import Image from 'next/image';

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
          <Card key={listing.id} className="relative overflow-hidden group">
            <Link href={`/listings/${listing.id}`}>
              <CardContent className="p-4">
                <div className="aspect-square bg-muted rounded-lg mb-4 relative overflow-hidden">
                  {listing.imageUrls && listing.imageUrls.length > 0 ? (
                    <div className="relative w-full h-full">
                      <img
                        src={listing.imageUrls[0]}
                        alt={listing.title}
                        className="object-cover w-full h-full rounded-lg transition-transform duration-300 group-hover:scale-105"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <span className="text-muted-foreground">No image</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg line-clamp-1">{listing.title}</h3>
                  <p className="text-xl font-bold">${listing.price.toLocaleString()}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">{listing.condition}</p>
                    {listing.isGraded && (
                      <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {listing.gradingCompany} {listing.gradeLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{listing.city}, {listing.state}</p>
                </div>
              </CardContent>
            </Link>
            {user && (
              <CardFooter className="p-4 pt-0 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(listing);
                  }}
                  className={`
                    transition-colors duration-200
                    ${isFavorite(listing.id) ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}
                  `}
                >
                  <Heart 
                    className={`h-5 w-5 ${isFavorite(listing.id) ? 'fill-current' : ''}`}
                    aria-label={isFavorite(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                  />
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button 
            onClick={onLoadMore} 
            variant="outline"
            className="min-w-[200px]"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}