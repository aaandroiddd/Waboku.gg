import { Listing } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ListingGridProps {
  listings?: Listing[];
  loading?: boolean;
  displayCount?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  userId?: string;
}

const getConditionColor = (condition: string) => {
  const colors: Record<string, string> = {
    'poor': 'bg-[#e51f1f]/10 text-[#e51f1f] hover:bg-[#e51f1f]/20',
    'played': 'bg-[#e85f2a]/10 text-[#e85f2a] hover:bg-[#e85f2a]/20',
    'light-played': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'good': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'excellent': 'bg-[#f7e379]/10 text-[#f7e379] hover:bg-[#f7e379]/20',
    'near-mint': 'bg-[#bbdb44]/10 text-[#bbdb44] hover:bg-[#bbdb44]/20',
    'mint': 'bg-[#44ce1b]/10 text-[#44ce1b] hover:bg-[#44ce1b]/20'
  };
  return colors[condition?.toLowerCase()] || 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
};

export function ListingGrid({ 
  listings: propListings = [], 
  loading = false, 
  displayCount = 8, 
  onLoadMore, 
  hasMore = false,
  userId 
}: ListingGridProps) {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadListings = async () => {
      try {
        if (userId) {
          // Filter listings for specific user
          const userListings = propListings.filter(listing => listing.userId === userId);
          if (isMounted) {
            setListings(userListings);
          }
        } else if (isMounted) {
          setListings(propListings || []);
        }
      } catch (error) {
        console.error('Error loading listings:', error);
        // Set empty listings array on error
        if (isMounted) {
          setListings([]);
        }
      }
    };

    loadListings();

    return () => {
      isMounted = false;
    };
  }, [userId, propListings]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 px-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-lg mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No listings found.</p>
      </div>
    );
  }

  const displayedListings = listings.slice(0, displayCount);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 px-4">
        {displayedListings.map((listing) => (
          <Link href={`/listings/${listing.id}`} key={listing.id} className="block">
            <Card className="group overflow-hidden border border-white/20 hover:border-white/40 dark:border-blue-300/20 dark:hover:border-blue-300/40 shadow-lg hover:shadow-xl transition-all duration-300 p-4">
              <div className="relative aspect-square w-full mb-4">
                {listing.imageUrls && listing.imageUrls[0] ? (
                  <Image
                    src={listing.imageUrls[0]}
                    alt={listing.title || 'Card listing'}
                    fill
                    className="object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    priority={true}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/rect.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center rounded-lg">
                    <span className="text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold truncate flex-1" title={listing.title}>
                    {listing.title}
                  </h3>
                  <span className="font-semibold text-base shrink-0">
                    ${typeof listing.price === 'number' ? listing.price.toFixed(2) : '0.00'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {listing.game && (
                    <Badge variant="secondary" className="text-xs rounded-md">
                      {listing.game}
                    </Badge>
                  )}
                  {listing.condition && (
                    <Badge className={`text-xs rounded-md ${getConditionColor(listing.condition)}`}>
                      {listing.condition}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <Link 
                    href={`/profile/${listing?.userId || 'unknown'}`}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (!listing?.userId) return;
                    }}
                  >
                    <User className="h-4 w-4" />
                    <span className="truncate">{listing.username || 'Unknown seller'}</span>
                  </Link>
                  {listing?.city && listing?.state && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{listing.city}, {listing.state}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button 
            onClick={onLoadMore}
            variant="outline"
            size="lg"
            className="min-w-[200px]"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}