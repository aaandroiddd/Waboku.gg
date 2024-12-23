import { Listing } from '@/types/database';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';

interface ListingGridProps {
  listings: Listing[];
  loading?: boolean;
}

export function ListingGrid({ listings, loading = false }: ListingGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded mb-4"></div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((listing) => (
        <Link href={`/listings/${listing.id}`} key={listing.id}>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="p-4">
              <div className="relative aspect-[4/3] w-full mb-4">
                {listing.imageUrls && listing.imageUrls[0] ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={listing.imageUrls[0]}
                      alt={listing.title}
                      fill
                      className="object-cover rounded-md"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={true}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/rect.png'; // Fallback image
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center rounded-md">
                    <span className="text-muted-foreground">No image available</span>
                  </div>
                )}
              </div>
              <CardTitle className="text-xl">{listing.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex gap-2 mb-2">
                <Badge variant="secondary">{listing.game}</Badge>
                <Badge variant="outline">{listing.condition}</Badge>
              </div>
              <p className="text-muted-foreground line-clamp-2">{listing.description}</p>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between items-center">
              <span className="text-2xl font-bold">
                ${typeof listing.price === 'number' ? listing.price.toFixed(2) : listing.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {listing.createdAt.toLocaleDateString()}
              </span>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}