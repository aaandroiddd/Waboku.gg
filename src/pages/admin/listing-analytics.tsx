import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, TrendingUp, Users, Package, ShoppingCart, AlertTriangle, Database, Hash } from 'lucide-react';
import { GAME_ICONS } from '@/lib/game-mappings';

interface CategoryStats {
  category: string;
  displayName: string;
  activeListings: number;
  archivedListings: number;
  totalListings: number;
  capacityUsed: number;
  shortIdMappings: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  recentListings: number;
}

interface OverallStats {
  totalActiveListings: number;
  totalArchivedListings: number;
  totalListings: number;
  totalUsers: number;
  totalOffers: number;
  totalOrders: number;
  totalReports: number;
  totalShortIdMappings: number;
  databaseSize: string;
  lastUpdated: string;
}

interface AnalyticsData {
  overallStats: OverallStats;
  categoryStats: CategoryStats[];
  capacityInfo: {
    maxListingsPerCategory: number;
    totalCapacity: number;
    usedCapacity: number;
    remainingCapacity: number;
  };
}

export default function ListingAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/listing-analytics', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setData(result);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const getCapacityColor = (percentage: number): string => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getCapacityStatus = (percentage: number): string => {
    if (percentage < 50) return 'Healthy';
    if (percentage < 75) return 'Moderate';
    if (percentage < 90) return 'High';
    return 'Critical';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Listing Analytics</h1>
            <p className="text-muted-foreground">Monitor marketplace health and capacity</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load analytics: {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={fetchAnalytics}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Listing Analytics</h1>
          <p className="text-muted-foreground">
            Monitor marketplace health and capacity • Last updated: {new Date(data.overallStats.lastUpdated).toLocaleString()}
          </p>
        </div>
        <Button 
          onClick={fetchAnalytics} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overallStats.totalActiveListings)}</div>
            <p className="text-xs text-muted-foreground">
              {data.overallStats.totalArchivedListings} archived
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overallStats.totalUsers)}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Offers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overallStats.totalOffers)}</div>
            <p className="text-xs text-muted-foreground">
              {data.overallStats.totalOrders} completed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.overallStats.totalReports)}</div>
            <p className="text-xs text-muted-foreground">
              Pending moderation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System Capacity Overview
          </CardTitle>
          <CardDescription>
            7-digit ID capacity monitoring across all categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Total Capacity</p>
              <p className="text-2xl font-bold">{formatNumber(data.capacityInfo.totalCapacity)}</p>
              <p className="text-xs text-muted-foreground">Across all categories</p>
            </div>
            <div>
              <p className="text-sm font-medium">Used Capacity</p>
              <p className="text-2xl font-bold">{formatNumber(data.capacityInfo.usedCapacity)}</p>
              <p className="text-xs text-muted-foreground">
                {((data.capacityInfo.usedCapacity / data.capacityInfo.totalCapacity) * 100).toFixed(3)}% utilized
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Short ID Mappings</p>
              <p className="text-2xl font-bold">{formatNumber(data.overallStats.totalShortIdMappings)}</p>
              <p className="text-xs text-muted-foreground">Database entries</p>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall System Capacity</span>
              <span>{((data.capacityInfo.usedCapacity / data.capacityInfo.totalCapacity) * 100).toFixed(3)}%</span>
            </div>
            <Progress 
              value={(data.capacityInfo.usedCapacity / data.capacityInfo.totalCapacity) * 100} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Statistics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Category Overview</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Details</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.categoryStats.map((category) => (
              <Card key={category.category}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-xl">{GAME_ICONS[category.category] || '🃏'}</span>
                    {category.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Active</p>
                      <p className="font-semibold">{formatNumber(category.activeListings)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Archived</p>
                      <p className="font-semibold">{formatNumber(category.archivedListings)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Recent (7d)</p>
                      <p className="font-semibold">{formatNumber(category.recentListings)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatNumber(category.totalListings)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Capacity Used</span>
                      <span>{category.capacityUsed.toFixed(3)}%</span>
                    </div>
                    <Progress value={category.capacityUsed} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-4">
          <div className="space-y-4">
            {data.categoryStats.map((category) => (
              <Card key={category.category}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{GAME_ICONS[category.category] || '🃏'}</span>
                      <div>
                        <h3 className="font-semibold">{category.displayName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(category.totalListings)} / {formatNumber(data.capacityInfo.maxListingsPerCategory)} listings
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={category.capacityUsed > 75 ? 'destructive' : category.capacityUsed > 50 ? 'secondary' : 'default'}>
                        {getCapacityStatus(category.capacityUsed)}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.capacityUsed.toFixed(3)}% used
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Progress value={category.capacityUsed} className="h-2" />
                    <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                      <div>
                        <Hash className="h-3 w-3 inline mr-1" />
                        {formatNumber(category.shortIdMappings)} mappings
                      </div>
                      <div>
                        Remaining: {formatNumber(data.capacityInfo.maxListingsPerCategory - category.totalListings)}
                      </div>
                      <div>
                        Est. years at current rate: {category.recentListings > 0 ? 
                          Math.round((data.capacityInfo.maxListingsPerCategory - category.totalListings) / (category.recentListings * 52)) : 
                          '∞'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.categoryStats
              .filter(cat => cat.averagePrice > 0)
              .map((category) => (
              <Card key={category.category}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <span>{GAME_ICONS[category.category] || '🃏'}</span>
                    {category.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Average</p>
                      <p className="font-semibold">{formatPrice(category.averagePrice)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min</p>
                      <p className="font-semibold">{formatPrice(category.priceRange.min)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max</p>
                      <p className="font-semibold">{formatPrice(category.priceRange.max)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on {formatNumber(category.activeListings)} active listings
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}