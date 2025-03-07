import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { TrendingUpIcon, BarChartIcon, LineChartIcon, PieChartIcon, LockIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Separator } from "@/components/ui/separator";

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
        ) : (
          <>
            {!isPremium && (
              <Card className="p-6 mb-8 border-primary/20 bg-primary/5">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <LockIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="mb-2">Premium Analytics Features</CardTitle>
                    <CardDescription className="mb-4 text-base">
                      Upgrade to premium to unlock full access to all analytics features, including real-time data, 
                      unlimited trending searches, price tracking, and personalized collection insights.
                    </CardDescription>
                    <Button 
                      onClick={() => router.push("/dashboard/account-status")}
                      className="mt-2"
                    >
                      Upgrade to Premium
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className={`p-6 ${isPremium ? 'hover:bg-accent/10 transition-colors cursor-pointer' : ''}`} 
                onClick={() => isPremium && router.push("/trending")}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <TrendingUpIcon className="h-8 w-8 mr-3 text-primary" />
                    <h2 className="text-2xl font-semibold">Trending Searches</h2>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Discover what other collectors are searching for in real-time. See the most popular search terms and their trends.
                  </p>
                  <div className="mt-auto">
                    {!isPremium ? (
                      <div>
                        <Separator className="my-4" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Preview available</span>
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push("/trending");
                            }}
                            variant="outline"
                            size="sm"
                          >
                            View Preview
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button className="w-full">
                        View Trending Searches
                      </Button>
                    )}
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}