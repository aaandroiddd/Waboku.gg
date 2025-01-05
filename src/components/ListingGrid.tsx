import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

                  {/* Favorite Button */}
                  <div className="absolute top-2 left-2 z-20">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!user) {
                          window.location.href = '/auth/sign-in';
                          return;
                        }
                        toggleFavorite(listing);
                      }}
                      className={`
                        bg-black/50 hover:bg-black/75 transition-colors duration-200 rounded-full
                        ${user && isFavorite(listing.id) ? 'text-red-500 hover:text-red-600' : 'text-white hover:text-red-500'}
                      `}
                    >
                      <Heart 
                        className={`h-5 w-5 ${user && isFavorite(listing.id) ? 'fill-current' : ''}`}
                        aria-label={user && isFavorite(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                      />
                    </Button>
                  </div>
                  
                  {/* Graded Badge */}
                  {listing.isGraded && (
                    <div className="absolute top-2 left-14 z-10">
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
                    <Badge className={`${getConditionColor(listing.condition).base} ${getConditionColor(listing.condition).hover}`}>
                      {listing.condition}
                    </Badge>
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