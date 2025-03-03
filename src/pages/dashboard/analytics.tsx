import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { TrendingUpIcon, BarChartIcon, LineChartIcon, PieChartIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile(user?.uid);

  // Check if user is premium
  const isPremium = profile?.tier === "premium";

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground mb-6">Gain insights into marketplace activity and trends</p>
        
        {profileLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : !isPremium ? (
          <Card className="p-6 text-center">
            <CardHeader>
              <CardTitle>Premium Feature</CardTitle>
              <CardDescription>
                Analytics features are available exclusively for premium users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push("/dashboard/account-status")}
                className="mt-4"
              >
                Upgrade to Premium
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 hover:bg-accent/10 transition-colors cursor-pointer" onClick={() => router.push("/trending")}>
              <div className="flex flex-col h-full">
                <div className="flex items-center mb-4">
                  <TrendingUpIcon className="h-8 w-8 mr-3 text-primary" />
                  <h2 className="text-2xl font-semibold">Trending Searches</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  Discover what other collectors are searching for in real-time. See the most popular search terms and their trends.
                </p>
                <div className="mt-auto">
                  <Button className="w-full">
                    View Trending Searches
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-muted/50">
              <div className="flex flex-col h-full">
                <div className="flex items-center mb-4">
                  <BarChartIcon className="h-8 w-8 mr-3 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold">Price Analytics</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  Track price trends for specific cards and sets. Understand market value fluctuations over time.
                </p>
                <div className="mt-auto">
                  <Badge className="mb-2">Coming Soon</Badge>
                  <Button disabled className="w-full">
                    View Price Analytics
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-muted/50">
              <div className="flex flex-col h-full">
                <div className="flex items-center mb-4">
                  <LineChartIcon className="h-8 w-8 mr-3 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold">Market Activity</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  Monitor listing activity, sales velocity, and regional hotspots for different card categories.
                </p>
                <div className="mt-auto">
                  <Badge className="mb-2">Coming Soon</Badge>
                  <Button disabled className="w-full">
                    View Market Activity
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-muted/50">
              <div className="flex flex-col h-full">
                <div className="flex items-center mb-4">
                  <PieChartIcon className="h-8 w-8 mr-3 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold">Collection Insights</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  Get personalized insights about your collection value, rarity distribution, and completion status.
                </p>
                <div className="mt-auto">
                  <Badge className="mb-2">Coming Soon</Badge>
                  <Button disabled className="w-full">
                    View Collection Insights
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}