import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/lib/price';
import Image from 'next/image';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, Package, CreditCard, User, MapPin, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrderDetails() {
      if (!id || !user) return;

      try {
        setLoading(true);
        const { db } = getFirebaseServices();
        
        // Get the order document
        const orderDoc = await getDoc(doc(db, 'orders', id as string));
        
        if (!orderDoc.exists()) {
          setError('Order not found');
          setLoading(false);
          return;
        }
        
        const orderData = orderDoc.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;
        
        // Check if the current user is either the buyer or seller
        if (orderData.buyerId !== user.uid && orderData.sellerId !== user.uid) {
          setError('You do not have permission to view this order');
          setLoading(false);
          return;
        }
        
        // Safely convert timestamps to dates
        const createdAt = orderData.createdAt?.toDate?.() || new Date();
        const updatedAt = orderData.updatedAt?.toDate?.() || new Date();
        
        setOrder({
          id: orderDoc.id,
          ...orderData,
          createdAt,
          updatedAt,
        });
      } catch (error) {
        console.error('Error fetching order details:', error);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetails();
  }, [id, user]);

  const handleBack = () => {
    router.push('/dashboard/orders');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
            </Button>
          </CardFooter>
        </Card>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
            <CardDescription>The requested order could not be found.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
            </Button>
          </CardFooter>
        </Card>
      </DashboardLayout>
    );
  }

  const isUserBuyer = user?.uid === order.buyerId;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
          </Button>
          <Badge
            variant={order.status === 'completed' ? 'default' : 
                   order.status === 'cancelled' ? 'destructive' : 'secondary'}
            className="text-sm"
          >
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              Order ID: <span className="font-mono">{order.id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Summary */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="relative w-full md:w-1/3 h-48 md:h-64">
                {order.listingSnapshot?.imageUrl ? (
                  <Image
                    src={order.listingSnapshot.imageUrl}
                    alt={order.listingSnapshot.title || 'Order item'}
                    fill
                    className="object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-muted-foreground">No image available</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-4">
                  {order.listingSnapshot?.title || `Order #${order.id.slice(0, 8)}`}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Order Date: {format(order.createdAt, 'PPP')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Last Updated: {format(order.updatedAt, 'PPP')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {isUserBuyer ? 'You purchased from a seller' : 'Sold to a buyer'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Payment Status: {order.paymentStatus || 'Unknown'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Price Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Item Price:</span>
                      <span>{formatPrice(order.listingSnapshot?.price || order.amount)}</span>
                    </div>
                    {order.platformFee !== undefined && (
                      <div className="flex justify-between">
                        <span>Platform Fee:</span>
                        <span>{formatPrice(order.platformFee)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>{formatPrice(order.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Information */}
            {order.shippingAddress && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Information
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="font-medium">{order.shippingAddress.name}</p>
                      <p>{order.shippingAddress.line1}</p>
                      {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                      <p>
                        {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                        {order.shippingAddress.postal_code}
                      </p>
                      <p>{order.shippingAddress.country}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payment Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </h3>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    {order.paymentSessionId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Session:</span>
                        <span className="font-mono">{order.paymentSessionId.slice(0, 12)}...</span>
                      </div>
                    )}
                    {order.paymentIntentId && typeof order.paymentIntentId === 'string' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Intent:</span>
                        <span className="font-mono">{order.paymentIntentId.slice(0, 12)}...</span>
                      </div>
                    )}
                    {isUserBuyer && order.transferId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transfer ID:</span>
                        <span className="font-mono">{order.transferId.slice(0, 12)}...</span>
                      </div>
                    )}
                    {isUserBuyer && order.transferAmount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transfer Amount:</span>
                        <span>{formatPrice(order.transferAmount)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
            </Button>
            
            {/* Additional actions could be added here based on order status */}
            {isUserBuyer && order.status === 'completed' && (
              <Button variant="outline" onClick={() => toast.info('Contact support for any issues with this order')}>
                <Package className="mr-2 h-4 w-4" /> Report Issue
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}