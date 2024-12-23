import { Listing } from '@/types/database';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';

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
        <Link href={`/listings/${listing.id}`} key={listing.id} className="block transform transition-all duration-300">
          <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/15 hover:border-primary/25">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="p-4">
              <div className="relative aspect-[4/3] w-full mb-4 overflow-hidden rounded-md">
                {listing.imageUrls && listing.imageUrls[0] ? (
                  <div className="relative w-full h-full transform transition-transform duration-300 group-hover:scale-105">
                    <Image
                      src={listing.imageUrls[0]}
                      alt={listing.title}
                      fill
                      className="object-cover rounded-md"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={true}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/rect.png';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center rounded-md">
                    <span className="text-muted-foreground">No image available</span>
                  </div>
                )}
              </div>
              <CardTitle className="text-xl group-hover:text-primary transition-colors duration-300">
                {listing.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="secondary">{listing.game}</Badge>
                <Badge className={getConditionColor(listing.condition)}>{listing.condition}</Badge>
                {listing.isGraded && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                    {listing.gradingCompany} {listing.gradeLevel}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground line-clamp-2">{listing.description}</p>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between items-center">
              <span className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">
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