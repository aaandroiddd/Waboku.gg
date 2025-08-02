import dynamic from 'next/dynamic';
import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useOffers } from '@/hooks/useOffers';
import { OfferCard } from '@/components/OfferCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/price';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Inner component that uses the dashboard context
const OffersContent = () => {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { clearUnreadCount, resetUnreadCount } = useUnread();
  const { getOffers, isLoadingOffers, refreshSection } = useDashboard();
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Get preloaded offers data
  const preloadedOffers = getOffers();
  
  // Fallback to useOffers hook for additional functionality
  const { receivedOffers: fallbackReceivedOffers, sentOffers: fallbackSentOffers, loading: offersLoading, error: offersError, fetchOffers, updateOfferStatus, makeCounterOffer } = useOffers();
  
  // Use preloaded data if available, otherwise fallback to hook data
  const allOffers = preloadedOffers.length > 0 ? preloadedOffers : [...fallbackReceivedOffers, ...fallbackSentOffers];
  
  // Separate received and sent offers
  const receivedOffers = allOffers.filter(offer => offer.sellerId === user?.uid);
  const sentOffers = allOffers.filter(offer => offer.buyerId === user?.uid);
  
  // Clear unread count when component mounts
  useEffect(() => {
    clearUnreadCount('offers');
    
    // Reset when component unmounts
    return () => {
      resetUnreadCount('offers');
    };
  }, [clearUnreadCount, resetUnreadCount]);
  
  // Listen for offer cleared events, status changes, and expirations
  useEffect(() => {
    const handleOfferCleared = (event: CustomEvent) => {
      // Refresh offers section when an offer is cleared
      refreshSection('offers');
    };
    
    const handleOfferStatusChanged = (event: CustomEvent) => {
      const { offerId, status, type } = event.detail;
      console.log(`Offer status changed event received: ${offerId} -> ${status} (${type})`);
      
      // Refresh offers data to ensure consistency
      setTimeout(() => {
        console.log('Refreshing offers due to status change event');
        refreshSection('offers');
      }, 500);
    };
    
    const handleOfferExpired = (event: CustomEvent) => {
      const { offerId } = event.detail;
      console.log(`Offer expired event received: ${offerId}`);
      
      // Show toast notification
      toast({
        title: "Offer Expired",
        description: "An offer has expired and will be updated automatically",
        variant: "default",
      });
      
      // Refresh offers data to show updated status
      setTimeout(() => {
        console.log('Refreshing offers due to expiration event');
        refreshSection('offers');
      }, 1000);
    };
    
    // Add event listeners
    window.addEventListener('offerCleared', handleOfferCleared as EventListener);
    window.addEventListener('offerStatusChanged', handleOfferStatusChanged as EventListener);
    window.addEventListener('offerExpired', handleOfferExpired as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('offerCleared', handleOfferCleared as EventListener);
      window.removeEventListener('offerStatusChanged', handleOfferStatusChanged as EventListener);
      window.removeEventListener('offerExpired', handleOfferExpired as EventListener);
    };
  }, [refreshSection, toast]);
  
  const [counterOfferDialog, setCounterOfferDialog] = useState({
    isOpen: false,
    offerId: '',
    originalAmount: 0,
    counterAmount: '',
    listingTitle: '',
  });

  const loading = authLoading || offersLoading;

  // Add a retry mechanism for initial data loading with multiple attempts
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptFetch = () => {
      if (offersError && retryCount < maxRetries) {
        // Increase retry delay with each attempt (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying offers fetch (attempt ${retryCount + 1}/${maxRetries}) in ${delay}ms`);
        
        const timer = setTimeout(() => {
          if (user) {  // Only refresh if we have a user
            retryCount++;
            fetchOffers();
          }
        }, delay);
        
        return () => clearTimeout(timer);
      }
    };
    
    return attemptFetch();
  }, [offersError, user, fetchOffers]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [user, loading, router]);

  const handleCounterOffer = (offerId: string, originalAmount: number, listingTitle: string) => {
    setCounterOfferDialog({
      isOpen: true,
      offerId,
      originalAmount,
      counterAmount: originalAmount.toString(),
      listingTitle,
    });
  };

  const submitCounterOffer = async () => {
    const amount = parseFloat(counterOfferDialog.counterAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const success = await makeCounterOffer(counterOfferDialog.offerId, amount);
      setCounterOfferDialog({ ...counterOfferDialog, isOpen: false });
      
      if (success) {
        // Dispatch custom event to notify the page to refresh
        window.dispatchEvent(new CustomEvent('offerStatusChanged', {
          detail: { offerId: counterOfferDialog.offerId, status: 'countered', type: 'received' }
        }));
        
        toast({
          title: "Counter offer sent",
          description: "Your counter offer has been sent successfully",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send counter offer",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await refreshSection('offers');
      toast({
        title: "Refreshed",
        description: "Your offers have been refreshed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to refresh offers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearExpiredDeclined = async () => {
    if (!user) return;
    
    // Use native HTML confirm dialog
    const confirmed = window.confirm(
      "Are you sure you want to clear all expired and declined offers? This action cannot be undone."
    );
    
    if (!confirmed) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/offers/clear-expired-declined', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Offers Cleared",
          description: data.message,
        });
        
        // Refresh offers data
        await refreshSection('offers');
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to clear offers",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Clear offers error:', error);
      toast({
        title: "Error",
        description: "An error occurred while clearing offers",
        variant: "destructive",
      });
    }
  };

  // Show loading skeleton if offers are still loading
  if (isLoadingOffers()) {
    return (
      <>
        <div className="mb-8 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-16 w-16 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || offersError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error || offersError}</p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </>
              )}
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
          <Button
            onClick={() => router.push('/auth/sign-in')}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight pl-5">Offers Dashboard</h1>
            <p className="text-muted-foreground mt-1 pl-5">
              Manage your received and sent offers for listings
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearExpiredDeclined}
            >
              Clear Expired & Declined
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue={router.query.tab === 'sent' ? 'sent' : 'received'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">Received Offers</TabsTrigger>
          <TabsTrigger value="sent">Sent Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          {receivedOffers.length === 0 ? (
            <EmptyStateCard
              title="No offers received"
              description="Received offers are price proposals from buyers interested in your listings."
              actionText="When someone makes an offer on your listings, it will appear here for you to accept, decline, or counter."
            />
          ) : (
            <div className="space-y-4">
              {receivedOffers.map((offer) => (
                <OfferCard 
                  key={offer.id} 
                  offer={offer} 
                  type="received" 
                  onCounterOffer={() => handleCounterOffer(
                    offer.id, 
                    offer.amount, 
                    offer.listingSnapshot.title
                  )}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {sentOffers.length === 0 ? (
            <EmptyStateCard
              title="No offers sent"
              description="Sent offers are price proposals you've made on other users' listings."
              actionText="To make an offer, visit a listing page and click the 'Make Offer' button."
            />
          ) : (
            <div className="space-y-4">
              {sentOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} type="sent" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Counter Offer Dialog */}
      <Dialog open={counterOfferDialog.isOpen} onOpenChange={(open) => setCounterOfferDialog({ ...counterOfferDialog, isOpen: open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Make Counter Offer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="listing">Listing</Label>
              <div className="text-sm text-muted-foreground">{counterOfferDialog.listingTitle}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="originalOffer">Original Offer</Label>
              <div className="text-sm font-medium">{formatPrice(counterOfferDialog.originalAmount)}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="counterAmount">Your Counter Offer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="counterAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={counterOfferDialog.counterAmount}
                  onChange={(e) => setCounterOfferDialog({ ...counterOfferDialog, counterAmount: e.target.value })}
                  className="pl-7"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCounterOfferDialog({ ...counterOfferDialog, isOpen: false })}>
              Cancel
            </Button>
            <Button type="button" onClick={submitCounterOffer}>
              Send Counter Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Main component that wraps content with DashboardLayout
const OffersComponent = () => {
  return (
    <DashboardLayout>
      <OffersContent />
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(OffersComponent), {
  ssr: false
});