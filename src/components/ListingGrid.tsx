import { Listing } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

interface ListingGridProps {
  listings: Listing[];
  loading?: boolean;
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
  return colors[condition.toLowerCase()] || 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
};

export function ListingGrid({ listings, loading = false }: ListingGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-lg mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No listings found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {listings.map((listing) => (
        <Link href={`/listings/${listing.id}`} key={listing.id} className="block">
          <Card className="group overflow-hidden border border-border/40 hover:border-border shadow-sm hover:shadow-md transition-all duration-300 p-3">
            <div className="relative aspect-square w-full mb-3">
              {listing.imageUrls && listing.imageUrls[0] ? (
                <Image
                  src={listing.imageUrls[0]}
                  alt={listing.title}
                  fill
                  className="object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
            
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold line-clamp-1 flex-1">{listing.title}</h3>
                <span className="font-semibold whitespace-nowrap">
                  ${typeof listing.price === 'number' ? listing.price.toFixed(2) : listing.price}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs rounded-md">
                  {listing.game}
                </Badge>
                <Badge className={`text-xs rounded-md ${getConditionColor(listing.condition)}`}>
                  {listing.condition}
                </Badge>
              </div>

              {listing.location && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  <span className="truncate">{listing.location}</span>
                </div>
              )}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}