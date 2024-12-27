import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useListings } from '@/hooks/useListings';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import Link from 'next/link';

export function ListingGrid({ userId }: { userId?: string }) {
  const { listings, isLoading, error } = useListings(userId);
  const { toggleFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map((listing) => (
        <Card key={listing.id} className="relative">
          <Link href={`/listings/${listing.id}`}>
            <CardContent className="p-4">
              <h3 className="font-semibold">{listing.title}</h3>
              <p className="text-muted-foreground">${listing.price}</p>
              <p className="text-sm text-muted-foreground mt-2">{listing.condition}</p>
            </CardContent>
          </Link>
          {user && (
            <CardFooter className="p-4 pt-0 flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(listing);
                }}
                className={isFavorite(listing.id) ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'}
              >
                <Heart className={`h-5 w-5 ${isFavorite(listing.id) ? 'fill-current' : ''}`} />
              </Button>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}