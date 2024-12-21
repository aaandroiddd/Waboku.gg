import dynamic from 'next/dynamic'
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DashboardLayout = dynamic(
  () => import('@/components/dashboard/DashboardLayout').then(mod => mod.DashboardLayout),
  {
    loading: () => (
      <div className="p-8">
        <Skeleton className="w-full h-[200px]" />
      </div>
    ),
    ssr: false
  }
);

export default function MessagesPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              Manage your conversations with other users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Message functionality coming soon...
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}