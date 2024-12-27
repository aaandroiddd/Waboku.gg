import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FavoritesPage() {
  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Favorites</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Your favorite listings will appear here.</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}