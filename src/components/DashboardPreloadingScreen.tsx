import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  MessageSquare, 
  Bell, 
  ShoppingCart, 
  Heart, 
  Star, 
  Search,
  FileText
} from 'lucide-react';
import { DashboardLoadingState } from '@/lib/dashboard-preloader';

interface DashboardPreloadingScreenProps {
  loading: DashboardLoadingState;
  className?: string;
}

const sections = [
  { key: 'listings', label: 'Listings', icon: Package },
  { key: 'offers', label: 'Offers', icon: ShoppingCart },
  { key: 'orders', label: 'Orders', icon: FileText },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'wantedPosts', label: 'Wanted Posts', icon: Search },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'favorites', label: 'Favorites', icon: Heart }
] as const;

export function DashboardPreloadingScreen({ loading, className = '' }: DashboardPreloadingScreenProps) {
  // Calculate overall progress
  const totalSections = sections.length;
  const completedSections = sections.filter(section => !loading[section.key]).length;
  const progress = (completedSections / totalSections) * 100;

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Loading Progress */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Loading Your Dashboard</h2>
              <p className="text-muted-foreground">
                We're preparing all your data for the best experience...
              </p>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Overall Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Section Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sections.map((section) => {
                const Icon = section.icon;
                const isLoading = loading[section.key];
                
                return (
                  <div
                    key={section.key}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      isLoading 
                        ? 'border-primary/20 bg-primary/5' 
                        : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                    }`}
                  >
                    <Icon 
                      className={`h-4 w-4 ${
                        isLoading 
                          ? 'text-primary animate-pulse' 
                          : 'text-green-600 dark:text-green-400'
                      }`} 
                    />
                    <span className={`text-sm font-medium ${
                      isLoading 
                        ? 'text-foreground' 
                        : 'text-green-700 dark:text-green-300'
                    }`}>
                      {section.label}
                    </span>
                    {!isLoading && (
                      <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Layout Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Skeleton */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Skeleton className="h-4 w-20 mb-2" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-32 mb-4" />
                    <div className="space-y-3">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Tips */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">💡 Did you know?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p className="mb-2">
                  <strong>Smart Caching:</strong> Your dashboard data is cached locally for faster loading on future visits.
                </p>
              </div>
              <div>
                <p className="mb-2">
                  <strong>Real-time Updates:</strong> Once loaded, your data stays synchronized automatically.
                </p>
              </div>
              <div>
                <p className="mb-2">
                  <strong>Offline Ready:</strong> Cached data remains available even when you're offline.
                </p>
              </div>
              <div>
                <p className="mb-2">
                  <strong>Background Refresh:</strong> Data refreshes in the background to stay current.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}