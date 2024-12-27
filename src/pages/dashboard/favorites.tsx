import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFavorites } from '@/hooks/useFavorites';
import { ListingGrid } from '@/components/ListingGrid';

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
              ) : (
                <ListingGrid userId="favorites" />
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}