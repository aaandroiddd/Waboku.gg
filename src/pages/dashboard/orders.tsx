import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice } from '@/lib/price';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useOffers } from '@/hooks/useOffers';
import { OfferCard } from '@/components/OfferCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function OrdersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { receivedOffers, sentOffers, loading: offersLoading, makeCounterOffer, fetchOffers } = useOffers();
  
  const [counterOfferDialog, setCounterOfferDialog] = useState({
    isOpen: false,
    offerId: '',
    originalAmount: 0,
    counterAmount: '',
    listingTitle: '',
  });
  
  // Handle offer cleared events
  const handleOfferCleared = useCallback((event: CustomEvent) => {
    const { offerId, type } = event.detail;
    console.log(`Offer cleared event received: ${offerId}, type: ${type}`);
    
    // Update the UI immediately by filtering out the cleared offer
    if (type === 'sent' || type === 'unknown') {
      setSentOffers(prev => prev.filter(offer => offer.id !== offerId));
    }
    
    if (type === 'received' || type === 'unknown') {
      setReceivedOffers(prev => prev.filter(offer => offer.id !== offerId));
    }
  }, []);

  // Set up event listener for offer cleared events
  useEffect(() => {
    // Add event listener for offer cleared events
    window.addEventListener('offerCleared', handleOfferCleared as EventListener);
    
    // Clean up event listener when component unmounts
    return () => {
      window.removeEventListener('offerCleared', handleOfferCleared as EventListener);
    };
  }, [handleOfferCleared]);

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return;

      try {
        const { db } = getFirebaseServices();
        
        // Fetch purchases
        const purchasesQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        
        // Fetch sales
        const salesQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const [purchasesSnapshot, salesSnapshot] = await Promise.all([
          getDocs(purchasesQuery),
          getDocs(salesQuery)
        ]);

        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as Order[];

        const salesData = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as Order[];

        setPurchases(purchasesData);
        setSales(salesData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [user]);

  const OrderCard = ({ order }: { order: Order }) => (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
            {order.listingSnapshot.imageUrl ? (
              <Image
                src={order.listingSnapshot.imageUrl}
                alt={order.listingSnapshot.title}
                fill
                className="object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No image</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{order.listingSnapshot.title}</h3>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Order ID: <span className="font-mono">{order.id.slice(0, 8)}...</span>
              </p>
              <p className="text-muted-foreground">
                Date: {format(order.createdAt, 'PPP')}
              </p>
              <p className="font-semibold">{formatPrice(order.amount)}</p>
              <Badge
                variant={order.status === 'completed' ? 'default' : 'secondary'}
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="md:w-1/3">
            <h4 className="font-semibold mb-2">Shipping Address</h4>
            <div className="text-sm text-muted-foreground">
              <p>{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.postal_code}
              </p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading || offersLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

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

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Orders & Offers Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="purchases">
            <TabsList>
              <TabsTrigger value="purchases">
                Purchases ({purchases.length})
              </TabsTrigger>
              <TabsTrigger value="sales">
                Sales ({sales.length})
              </TabsTrigger>
              <TabsTrigger value="received-offers">
                Received Offers ({receivedOffers.length})
              </TabsTrigger>
              <TabsTrigger value="sent-offers">
                Sent Offers ({sentOffers.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="purchases" className="mt-4">
              {purchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You haven't made any purchases yet.
                </p>
              ) : (
                purchases.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </TabsContent>
            <TabsContent value="sales" className="mt-4">
              {sales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You haven't made any sales yet.
                </p>
              ) : (
                sales.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </TabsContent>
            <TabsContent value="received-offers" className="mt-4">
              {receivedOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You haven't received any offers yet.
                </p>
              ) : (
                receivedOffers.map((offer) => (
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
                ))
              )}
            </TabsContent>
            <TabsContent value="sent-offers" className="mt-4">
              {sentOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You haven't sent any offers yet.
                </p>
              ) : (
                sentOffers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} type="sent" />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
}