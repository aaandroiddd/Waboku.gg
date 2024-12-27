import { Card, CardContent } from '@/components/ui/card';
import { useListings } from '@/hooks/useListings';

export function ListingGrid({ userId }: { userId?: string }) {
  const { listings, isLoading, error } = useListings(userId);

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
        <Card key={listing.id}>
          <CardContent className="p-4">
            <h3 className="font-semibold">{listing.title}</h3>
            <p className="text-muted-foreground">${listing.price}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}