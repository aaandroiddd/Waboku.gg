import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Listing } from '@/types/database';
import { formatPrice } from '@/lib/price';
import { getListingUrl } from '@/lib/listing-slug';
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
    <Link href={getListingUrl(listing)} className="block h-full">
      <Card className="overflow-hidden h-full hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-3 h-full flex flex-col">
          <div className="aspect-square bg-muted rounded-lg mb-2 relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/80 to-muted animate-pulse" />
            <Image
              key={`${listing.id}-${imageUrl}`} // Add unique key to prevent caching issues
              src={imageUrl}
              alt={listing.title}
              className="rounded-lg object-cover"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
              priority={false}
              unoptimized={imageUrl.includes('/api/images/')} // Disable optimization for proxy URLs
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

            {/* Final Sale Badge */}
            {listing.finalSale && listing.status === 'active' && (
              <div className="absolute top-2 left-2 z-10">
                <span className="px-2 py-1 bg-orange-500/90 text-white rounded-md font-semibold flex items-center gap-1 text-xs whitespace-nowrap">
                  <svg 
                    viewBox="0 0 24 24" 
                    className="w-3 h-3" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Final Sale</span>
                </span>
              </div>
            )}
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