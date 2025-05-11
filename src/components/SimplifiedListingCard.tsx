import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Listing } from '@/types/database';
import { formatPrice } from '@/lib/price';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

interface SimplifiedListingCardProps {
  listing: Listing;
}

export const SimplifiedListingCard = ({ listing }: SimplifiedListingCardProps) => {
  // Safely determine the image URL to use
  const coverIndex = typeof listing.coverImageIndex === 'number' ? listing.coverImageIndex : 0;
  const safeIndex = Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0 
    ? Math.min(coverIndex, listing.imageUrls.length - 1) 
    : 0;
  const imageUrl = Array.isArray(listing.imageUrls) && listing.imageUrls.length > 0 
    ? listing.imageUrls[safeIndex] 
    : '/images/rect.png';

  return (
    <Link href={`/listings/${listing.id}`} className="block h-full">
      <Card className="overflow-hidden h-full hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-3 h-full flex flex-col">
          <div className="aspect-square bg-muted rounded-lg mb-2 relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/80 to-muted animate-pulse" />
            <Image
              src={imageUrl}
              alt={listing.title}
              className="rounded-lg object-cover"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/rect.png';
              }}
            />
            {/* Price Badge or Offers Only Badge */}
            <div className="absolute bottom-2 right-2 z-10">
              <span className="px-2 py-1 bg-black/75 text-white rounded-md font-semibold text-sm">
                {listing.offersOnly ? "Offers Only" : formatPrice(listing.price)}
              </span>
            </div>
          </div>
          <div className="flex-grow">
            <h3 className="font-medium text-sm line-clamp-2">{listing.title}</h3>
            <div className="flex items-center mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{listing.city}, {listing.state}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};