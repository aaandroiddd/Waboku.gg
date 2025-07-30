import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Package, 
  Bell, 
  MessageSquare, 
  Star, 
  DollarSign, 
  Crown,
  User,
  ChevronRight,
  Eye,
  TrendingUp
} from 'lucide-react';
import { useOptimizedListings } from '@/hooks/useOptimizedListings';
import { useNotifications } from '@/hooks/useNotifications';
import { useOffers } from '@/hooks/useOffers';
import { useReviews } from '@/hooks/useReviews';
import { useMessages } from '@/hooks/useMessages';
import { useSimplifiedPremiumStatus } from '@/hooks/useSimplifiedPremiumStatus';
import { useStripeConnectAccount } from '@/hooks/useStripeConnectAccount';
import { ProfileName } from '@/components/ProfileName';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { RatingStars } from '@/components/RatingStars';

export default function DashboardOverview() {
  const router = useRouter();
  const { user, profile } = useAuth();
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

  // Calculate stats with comprehensive null/undefined checks and error boundaries
  const safeListings = React.useMemo(() => {
    try {
      return Array.isArray(listings) ? listings.filter(Boolean) : [];
    } catch (error) {
      console.warn('Error processing listings:', error);
      return [];
    }
  }, [listings]);

  const safeNotifications = React.useMemo(() => {
    try {
      return Array.isArray(notifications) ? notifications.filter(Boolean) : [];
    } catch (error) {
      console.warn('Error processing notifications:', error);
      return [];
    }
  }, [notifications]);

  const safeReceivedOffers = React.useMemo(() => {
    try {
      const offers = Array.isArray(receivedOffers) ? receivedOffers.filter(Boolean) : [];
      console.log('DashboardOverview - Processing received offers:', {
        totalOffers: offers.length,
        rawReceivedOffers: receivedOffers,
        offers: offers.map(offer => ({
          id: offer.id,
          amount: offer.amount,
          status: offer.status,
          listingTitle: offer.listingSnapshot?.title,
          createdAt: offer.createdAt,
          cleared: offer.cleared,
          expiresAt: offer.expiresAt
        }))
      });
      
      // Filter to only show non-cleared, active offers for the dashboard overview
      const activeOffers = offers.filter(offer => {
        const isNotCleared = !offer.cleared;
        const isActiveStatus = ['pending', 'accepted', 'countered'].includes(offer.status);
        
        console.log(`Offer ${offer.id}: cleared=${offer.cleared}, status=${offer.status}, isNotCleared=${isNotCleared}, isActiveStatus=${isActiveStatus}`);
        
        return isNotCleared && isActiveStatus;
      });
      
      console.log('DashboardOverview - Filtered active offers:', {
        totalActiveOffers: activeOffers.length,
        activeOffers: activeOffers.map(offer => ({
          id: offer.id,
          amount: offer.amount,
          status: offer.status,
          listingTitle: offer.listingSnapshot?.title
        }))
      });
      
      return activeOffers;
    } catch (error) {
      console.warn('Error processing offers:', error);
      return [];
    }
  }, [receivedOffers]);
=======

  const safeReviews = React.useMemo(() => {
    try {
      return Array.isArray(reviews) ? reviews.filter(Boolean) : [];
    } catch (error) {
      console.warn('Error processing reviews:', error);
      return [];
    }
  }, [reviews]);

  const safeMessageThreads = React.useMemo(() => {
    try {
      return Array.isArray(messageThreads) ? messageThreads.filter(Boolean) : [];
    } catch (error) {
      console.warn('Error processing message threads:', error);
      return [];
    }
  }, [messageThreads]);

  const activeListings = React.useMemo(() => {
    try {
      return safeListings.filter(listing => listing && listing.status === 'active');
    } catch (error) {
      console.warn('Error filtering active listings:', error);
      return [];
    }
  }, [safeListings]);

  const unreadNotifications = React.useMemo(() => {
    try {
      return safeNotifications.filter(notification => notification && !notification.read);
    } catch (error) {
      console.warn('Error filtering unread notifications:', error);
      return [];
    }
  }, [safeNotifications]);

  const latestNotification = React.useMemo(() => {
    try {
      return safeNotifications.length > 0 && safeNotifications[0] ? safeNotifications[0] : null;
    } catch (error) {
      console.warn('Error getting latest notification:', error);
      return null;
    }
  }, [safeNotifications]);

  const latestOffer = React.useMemo(() => {
    try {
      return safeReceivedOffers.length > 0 && safeReceivedOffers[0] ? safeReceivedOffers[0] : null;
    } catch (error) {
      console.warn('Error getting latest offer:', error);
      return null;
    }
  }, [safeReceivedOffers]);

  const latestMessage = React.useMemo(() => {
    try {
      return safeMessageThreads.length > 0 && safeMessageThreads[0] ? safeMessageThreads[0] : null;
    } catch (error) {
      console.warn('Error getting latest message:', error);
      return null;
    }
  }, [safeMessageThreads]);

  // Calculate current month's revenue (placeholder - would need actual sales data)
  const currentMonthRevenue = 0; // TODO: Implement actual revenue calculation

  const handleSectionClick = (path: string) => {
    router.push(path);
  };

  const handleViewProfile = () => {
    if (profile?.username) {
      router.push(`/profile/${profile.username}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Profile View */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, <ProfileName user={user} />
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleViewProfile}
                className="cursor-pointer hover:scale-105 transition-all duration-200 group"
              >
                <ProfileAvatar 
                  user={user} 
                  size="xl" 
                  className="border-4 border-primary/30 hover:border-primary/60 transition-all duration-200 shadow-lg hover:shadow-xl group-hover:ring-4 group-hover:ring-primary/20"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View profile</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Listings */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/listings')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {listingsLoading ? <Skeleton className="h-8 w-12" /> : activeListings.length}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {safeListings.length - activeListings.length} archived
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/notifications')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
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
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            {latestNotification && (
              <p className="text-xs text-muted-foreground truncate">
                {latestNotification.title}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/messages')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {messagesLoading ? <Skeleton className="h-8 w-12" /> : safeMessageThreads.length}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            {latestMessage && (
              <p className="text-xs text-muted-foreground truncate">
                Latest: {latestMessage.subject || 'No subject'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/reviews')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {reviewsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{(averageRating || 0).toFixed(1)}</span>
                    <RatingStars rating={averageRating || 0} size="sm" />
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {safeReviews.length} total reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Offers */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/offers')}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Latest Offers
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offersLoading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : safeReceivedOffers && safeReceivedOffers.length > 0 ? (
              <div className="space-y-3">
                {safeReceivedOffers.slice(0, 3).map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">${offer.amount}</p>
                      <p className="text-xs text-muted-foreground">
                        {offer.listingSnapshot?.title || 'Unknown listing'}
                      </p>
                    </div>
                    <Badge variant={offer.status === 'pending' ? 'default' : 'secondary'}>
                      {offer.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent offers</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/reviews')}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Reviews
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewsLoading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1 mb-1">
                      {Array(5).fill(0).map((_, j) => (
                        <Skeleton key={j} className="h-3 w-3" />
                      ))}
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : safeReviews.length > 0 ? (
              <div className="space-y-3">
                {safeReviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {review.comment || 'No comment provided'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent reviews</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Status and Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Status */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/account-status')}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Account Status
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isPremium ? (
                <>
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <Badge variant="default" className="bg-yellow-500">Premium</Badge>
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="secondary">Free</Badge>
                </>
              )}
            </div>
            {!isPremium && (
              <p className="text-xs text-muted-foreground mt-2">
                Upgrade to unlock more features
              </p>
            )}
          </CardContent>
        </Card>

        {/* Revenue (if Stripe connected) */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleSectionClick('/dashboard/sales-analytics')}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              This Month's Revenue
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div className="text-2xl font-bold">
                {stripeLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  `$${currentMonthRevenue.toFixed(2)}`
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stripeAccount ? 'Connected to Stripe' : 'Connect Stripe to track revenue'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}