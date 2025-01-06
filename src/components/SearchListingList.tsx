import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { Listing } from "@/types/database";
import Link from "next/link";
import { formatPrice } from "@/lib/price";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";

interface SearchListingListProps {
  listings: Listing[];
  loading?: boolean;
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

export function SearchListingList({ listings, loading }: SearchListingListProps) {
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useFavorites();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex gap-4">
              <div className="h-20 w-20 bg-secondary rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary rounded w-3/4" />
                <div className="h-4 bg-secondary rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!listings?.length) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">No listings found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {listings.map((listing) => (
        <Card 
          key={listing.id} 
          className="relative overflow-hidden group transition-all duration-200 hover:bg-accent/50"
        >
          <Link href={`/listings/${listing.id}`}>
            <div className="p-4 flex gap-4">
              {/* Image Section */}
              <div className="relative h-24 sm:h-32 w-24 sm:w-32 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
                {listing.imageUrls?.[0] ? (
                  <img
                    src={listing.imageUrls[0]}
                    alt={listing.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-muted-foreground">No image</span>
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="font-medium text-base sm:text-lg line-clamp-1">{listing.title}</h3>
                    <p className="text-base sm:text-lg font-bold">{formatPrice(listing.price)}</p>
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
                  </div>

                  {/* Favorite Button */}
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
                      rounded-full
                      ${user && isFavorite(listing.id) ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}
                    `}
                  >
                    <Heart 
                      className={`h-5 w-5 ${user && isFavorite(listing.id) ? 'fill-current' : ''}`}
                      aria-label={user && isFavorite(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                    />
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-2">
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
                <p className="text-xs text-muted-foreground mt-2">{listing.city}, {listing.state}</p>
              </div>
            </div>
          </Link>
        </Card>
      ))}
    </div>
  );
}