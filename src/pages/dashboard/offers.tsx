import dynamic from 'next/dynamic';
import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useOffers } from '@/hooks/useOffers';
import { OfferCard } from '@/components/OfferCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/price';

const OffersComponent = () => {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { receivedOffers, sentOffers, loading: offersLoading, error: offersError, fetchOffers, updateOfferStatus, makeCounterOffer } = useOffers();
  
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
      await makeCounterOffer(counterOfferDialog.offerId, amount);
      setCounterOfferDialog({ ...counterOfferDialog, isOpen: false });
      toast({
        title: "Counter offer sent",
        description: "Your counter offer has been sent successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send counter offer",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || offersError) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600">{error || offersError}</p>
            <Button
              className="mt-4"
              onClick={() => router.push('/auth/sign-in')}
            >
              Return to Sign In
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Offers Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manage your received and sent offers for listings
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">Received Offers</TabsTrigger>
          <TabsTrigger value="sent">Sent Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          {receivedOffers.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium mb-2">No offers received</h3>
              <p className="text-muted-foreground">
                When someone makes an offer on your listings, they will appear here.
              </p>
            </div>
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
            <div className="text-center py-12">
              <h3 className="text-lg font-medium mb-2">No offers sent</h3>
              <p className="text-muted-foreground">
                When you make an offer on a listing, it will appear here.
              </p>
            </div>
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
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(OffersComponent), {
  ssr: false
});