import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { Listing } from '@/types/database';
import Image from 'next/image';
import { formatPrice } from '@/lib/price';

interface ListingGridProps {
  listings: Listing[];
  loading?: boolean;
  displayCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  userId?: string;
}

const getConditionColor = (condition: string): string => {
  const colors: Record<string, string> = {
    'poor': 'bg-[#e51f1f]/10 text-[#e51f1f]',
    'played': 'bg-[#e85f2a]/10 text-[#e85f2a]',
    'light played': 'bg-[#f2a134]/10 text-[#f2a134]',
    'good': 'bg-[#f2a134]/10 text-[#f2a134]',
    'excellent': 'bg-[#f7e379]/10 text-[#f7e379]',
    'near mint': 'bg-[#bbdb44]/10 text-[#bbdb44]',
    'mint': 'bg-[#44ce1b]/10 text-[#44ce1b]'
  };
  return colors[condition?.toLowerCase()] || 'bg-gray-500/10 text-gray-500';
};

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
                  {/* Price Badge */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className="px-3 py-1 bg-black/75 text-white rounded-md font-semibold">
                      {formatPrice(listing.price)}
                    </span>
                  </div>
                  
                  {/* Graded Badge */}
                  {listing.isGraded && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="px-3 py-1 bg-blue-500/90 text-white rounded-md font-semibold flex items-center gap-1">
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-4 h-4 mr-1" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                          <path d="M2 17L12 22L22 17" />
                          <path d="M2 12L12 17L22 12" />
                        </svg>
                        <span className="text-xs">{listing.gradingCompany}</span>
                        <span className="font-bold">{listing.gradeLevel}</span>
                      </span>
                    </div>
                  )}
                  
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
                  <h3 className="font-medium text-base line-clamp-1">{listing.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    by{" "}
                    <Link
                      href={`/profile/${listing.userId}`}
                      className="hover:text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {listing.username}
                    </Link>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">{listing.game}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getConditionColor(listing.condition)}`}>
                      {listing.condition}
                    </span>
                    {listing.isGraded && (
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                        {listing.gradingCompany} {listing.gradeLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{listing.city}, {listing.state}</p>
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