import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptimizedListings } from '@/hooks/useOptimizedListings';
import { useNotifications } from '@/hooks/useNotifications';
import { useOffers } from '@/hooks/useOffers';
import { useReviews } from '@/hooks/useReviews';
import { useMessages } from '@/hooks/useMessages';
import { useSimplifiedPremiumStatus } from '@/hooks/useSimplifiedPremiumStatus';
import { useStripeConnectAccount } from '@/hooks/useStripeConnectAccount';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { ProfileName } from '@/components/ProfileName';
import { RatingStars } from '@/components/RatingStars';
import { 
  Package, 
  Bell, 
  MessageSquare, 
  Star, 
  DollarSign, 
  Crown,
  User,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';

const DashboardOverview: NextPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showRevenue, setShowRevenue] = useState(true);

  // Hooks for data with error boundaries
  const { listings, loading: listingsLoading } = useOptimizedListings({ 
    userId: user?.uid, 
    showOnlyActive: false 
  });
  const { notifications, loading: notificationsLoading } = useNotifications();
  const { receivedOffers, loading: offersLoading } = useOffers();
  const { reviews, averageRating, loading: reviewsLoading } = useReviews(user?.uid);
  const { messageThreads, loading: messagesLoading } = useMessages();
  const { isPremium, tier } = useSimplifiedPremiumStatus();
  const { account: stripeAccount, loading: stripeLoading } = useStripeConnectAccount();

  // Calculate stats with comprehensive null/undefined checks
  const safeListings = Array.isArray(listings) ? listings : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeReceivedOffers = Array.isArray(receivedOffers) ? receivedOffers : [];
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const safeMessageThreads = Array.isArray(messageThreads) ? messageThreads : [];

  const activeListings = safeListings.filter(listing => listing && listing.status === 'active');
  const unreadNotifications = safeNotifications.filter(notification => notification && !notification.read);
  const latestNotification = safeNotifications.length > 0 ? safeNotifications[0] : null;
  const latestOffer = safeReceivedOffers.length > 0 ? safeReceivedOffers[0] : null;
  const latestReview = safeReviews.length > 0 ? safeReviews[0] : null;
  const latestMessage = safeMessageThreads.length > 0 ? safeMessageThreads[0] : null;

  // Calculate current month's revenue (placeholder - would need actual sales data)
  const currentMonthRevenue = 0; // TODO: Implement actual revenue calculation

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <ProfileAvatar user={user} size="xl" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, <ProfileName user={user} />
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your account
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Active Listings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {listingsLoading ? <Skeleton className="h-8 w-12" /> : activeListings.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {safeListings.length - activeListings.length} archived
              </p>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notificationsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <>
                    {unreadNotifications.length}
                    {unreadNotifications.length > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        New
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {latestNotification && (
                <p className="text-xs text-muted-foreground truncate">
                  {latestNotification.title}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Latest Offer */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Offer</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {offersLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : latestOffer ? (
                <>
                  <div className="text-2xl font-bold">${latestOffer.amount}</div>
                  <p className="text-xs text-muted-foreground">
                    Status: {latestOffer.status}
                  </p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No offers yet</div>
              )}
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">{(averageRating || 0).toFixed(1)}</div>
                    <RatingStars rating={averageRating || 0} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {safeReviews.length} total reviews
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{safeMessageThreads.length}</div>
                  {latestMessage && (
                    <p className="text-xs text-muted-foreground truncate">
                      Latest: {latestMessage.subject || 'No subject'}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Revenue (if Stripe connected) */}
          {stripeAccount && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRevenue(!showRevenue)}
                    className="h-auto p-0"
                  >
                    {showRevenue ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {showRevenue ? `$${currentMonthRevenue.toFixed(2)}` : '••••'}
                </div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant={isPremium ? "default" : "secondary"} className="flex items-center gap-1">
                {isPremium && <Crown className="h-3 w-3" />}
                {isPremium ? 'Premium' : 'Free'} Account
              </Badge>
              {!isPremium && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/dashboard/account-status')}
                >
                  Upgrade to Premium
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {isPremium 
                ? 'You have access to all premium features including unlimited listings, advanced analytics, and priority support.'
                : 'Upgrade to premium for unlimited listings, advanced analytics, and more features.'
              }
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button 
            onClick={() => router.push('/dashboard/create-listing')}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <Package className="h-6 w-6" />
            Create Listing
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/dashboard/listings')}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <Package className="h-6 w-6" />
            View Listings
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/dashboard/messages')}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <MessageSquare className="h-6 w-6" />
            Messages
          </Button>
          <Button 
            variant="outline"
            onClick={() => router.push('/dashboard/offers')}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <TrendingUp className="h-6 w-6" />
            View Offers
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardOverview;