import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { ListingGrid } from '@/components/ListingGrid';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function FavoritesPage() {
  const { favorites, isLoading } = useFavorites();

  return (
    <RouteGuard requireAuth>
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>My Favorites</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-4 bg-secondary rounded w-1/2" />
                </div>
              ) : favorites.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map((listing) => (
                    <Link href={`/listings/${listing.id}`} key={listing.id}>
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="aspect-square relative mb-2">
                            {listing.images && listing.images[0] && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={listing.images[0]}
                                alt={listing.title}
                                className="object-cover w-full h-full rounded-md"
                              />
                            )}
                          </div>
                          <h3 className="font-semibold text-lg mb-1">{listing.title}</h3>
                          <p className="text-muted-foreground">${listing.price}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
                  <p className="text-muted-foreground mb-4">Start browsing listings to add some favorites!</p>
                  <Button asChild>
                    <Link href="/listings">Browse Listings</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}