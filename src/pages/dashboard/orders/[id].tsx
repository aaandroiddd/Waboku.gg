import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/lib/price';
import Image from 'next/image';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, Package, CreditCard, User, MapPin, Calendar, Clock, Truck, AlertTriangle, Copy, ExternalLink, Info, RefreshCw, CheckCircle, Star, MessageCircle, HelpCircle, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TrackingStatusComponent } from '@/components/TrackingStatus';
import { UserNameLink } from '@/components/UserNameLink';
import { ReviewForm } from '@/components/ReviewForm';
import { OrderShippingInfoDialog } from '@/components/OrderShippingInfoDialog';
import { RefundRequestDialog } from '@/components/RefundRequestDialog';
import { RefundManagementDialog } from '@/components/RefundManagementDialog';
import { MessageDialog } from '@/components/MessageDialog';
import { generateListingUrl } from '@/lib/listing-slug';
import { addDays } from 'date-fns';

export default function OrderDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNotes, setTrackingNotes] = useState('');
  const [isUpdatingShipping, setIsUpdatingShipping] = useState(false);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false);
  const [isCompletingPickup, setIsCompletingPickup] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [showNoTrackingDialog, setShowNoTrackingDialog] = useState(false);
  const [showConfirmDeliveryDialog, setShowConfirmDeliveryDialog] = useState(false);
  const [showCompletePickupDialog, setShowCompletePickupDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showShippingInfoDialog, setShowShippingInfoDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showRefundManagementDialog, setShowRefundManagementDialog] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Check if we should show the review dialog based on URL query param
  useEffect(() => {
    if (router.query.review === 'true' && order?.status === 'completed' && !order?.reviewSubmitted) {
      setShowReviewDialog(true);
    }
    
    // Check if we should show the shipping info dialog based on URL query param
    if (router.query.shipping === 'true' && order?.status === 'awaiting_shipping' && !order?.shippingAddress) {
      setShowShippingInfoDialog(true);
    }
  }, [router.query, order]);

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
        
        const rawOrderData = orderDoc.data();
        
        // Map the shipping data from Firestore structure to Order interface
        const shippingAddress = rawOrderData.shipping?.address ? {
          name: rawOrderData.shipping.address.name || '',
          line1: rawOrderData.shipping.address.line1 || '',
          line2: rawOrderData.shipping.address.line2 || '',
          city: rawOrderData.shipping.address.city || '',
          state: rawOrderData.shipping.address.state || '',
          postal_code: rawOrderData.shipping.address.postal_code || '',
          country: rawOrderData.shipping.address.country || '',
        } : rawOrderData.shippingAddress;

        const orderData = {
          ...rawOrderData,
          shippingAddress,
        } as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;
        
        // Check if the current user is either the buyer or seller
        if (orderData.buyerId !== user.uid && orderData.sellerId !== user.uid) {
          setError('You do not have permission to view this order');
          setLoading(false);
          return;
        }
        
        // Safely convert timestamps to dates
        const createdAt = orderData.createdAt?.toDate?.() || new Date();
        const updatedAt = orderData.updatedAt?.toDate?.() || new Date();
        
        const orderWithDates = {
          id: orderDoc.id,
          ...orderData,
          createdAt,
          updatedAt,
        };
        
        setOrder(orderWithDates);
        
        // Fetch user information after setting the order
        fetchUserInfo(orderWithDates.buyerId, orderWithDates.sellerId);
      } catch (error) {
        console.error('Error fetching order details:', error);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetails();
  }, [id, user]);
  
  // Function to fetch buyer and seller information
  const fetchUserInfo = async (buyerId: string, sellerId: string) => {
    if (!buyerId || !sellerId) return;
    
    setLoadingUserInfo(true);
    try {
      const { db } = getFirebaseServices();
      console.log(`[OrderDetails] Fetching user info for buyerId: ${buyerId}, sellerId: ${sellerId}`);
      
      // Fetch buyer info
      const buyerDoc = await getDoc(doc(db, 'users', buyerId));
      if (buyerDoc.exists()) {
        const buyerData = buyerDoc.data();
        const name = buyerData.displayName || buyerData.username || 'Unknown User';
        console.log(`[OrderDetails] Found buyer name: ${name}`);
        setBuyerName(name);
      } else {
        console.warn(`[OrderDetails] Buyer document not found for buyerId: ${buyerId}`);
        setBuyerName('Unknown User');
      }
      
      // Fetch seller info
      const sellerDoc = await getDoc(doc(db, 'users', sellerId));
      if (sellerDoc.exists()) {
        const sellerData = sellerDoc.data();
        const name = sellerData.displayName || sellerData.username || 'Unknown User';
        console.log(`[OrderDetails] Found seller name: ${name}`);
        setSellerName(name);
      } else {
        console.warn(`[OrderDetails] Seller document not found for sellerId: ${sellerId}`);
        setSellerName('Unknown User');
      }
    } catch (error) {
      console.error('[OrderDetails] Error fetching user information:', error);
      setBuyerName('Unknown User');
      setSellerName('Unknown User');
    } finally {
      setLoadingUserInfo(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard/orders');
  };
  
  // Function to add tracking information
  const handleAddTracking = async () => {
    if (!order || !id || !trackingNumber) return;
    
    try {
      setIsUpdatingShipping(true);
      const { db } = getFirebaseServices();
      
      // If carrier is empty, we'll let the API detect it
      // The carrier will be updated later when the tracking status is fetched
      const carrierValue = carrier.trim() || 'auto-detect';
      
      // Update the order with tracking information
      await updateDoc(doc(db, 'orders', id as string), {
        status: 'shipped',
        trackingInfo: {
          carrier: carrierValue,
          trackingNumber,
          notes: trackingNotes,
          addedAt: new Date(),
          addedBy: user?.uid,
          autoDetect: !carrier.trim() // Flag to indicate carrier should be auto-detected
        },
        trackingRequired: true, // Ensure tracking is marked as required
        updatedAt: new Date()
      });
      
      // Update local state
      setOrder({
        ...order,
        status: 'shipped',
        trackingInfo: {
          carrier: carrierValue,
          trackingNumber,
          notes: trackingNotes,
          addedAt: new Date(),
          addedBy: user?.uid,
          autoDetect: !carrier.trim()
        },
        trackingRequired: true,
        updatedAt: new Date()
      });
      
      toast.success('Tracking information added successfully');
      setShowTrackingDialog(false);
    } catch (error) {
      console.error('Error adding tracking information:', error);
      toast.error('Failed to add tracking information');
    } finally {
      setIsUpdatingShipping(false);
    }
  };
  
  // Function to mark as shipped without tracking
  const handleMarkAsShipped = async () => {
    if (!order || !id) return;
    
    try {
      setIsUpdatingShipping(true);
      const { db } = getFirebaseServices();
      
      // Update the order status to completed without tracking info
      // As per requirements, when marked as shipped without tracking, change status to completed
      await updateDoc(doc(db, 'orders', id as string), {
        status: 'completed',
        noTrackingConfirmed: true,
        trackingRequired: false, // Explicitly mark that tracking is not required for this order
        deliveryConfirmed: true, // Mark as delivered since we're completing the order
        updatedAt: new Date()
      });
      
      // Update local state
      setOrder({
        ...order,
        status: 'completed',
        noTrackingConfirmed: true,
        trackingRequired: false,
        deliveryConfirmed: true,
        updatedAt: new Date()
      });
      
      toast.success('Order marked as completed');
      setShowNoTrackingDialog(false);
    } catch (error) {
      console.error('Error marking order as completed:', error);
      toast.error('Failed to update order status');
    } finally {
      setIsUpdatingShipping(false);
    }
  };
  
  // Function for buyer to confirm delivery
  const handleConfirmDelivery = async () => {
    if (!order || !id) return;
    
    try {
      setIsConfirmingDelivery(true);
      const { db } = getFirebaseServices();
      
      // Update the order status to completed
      await updateDoc(doc(db, 'orders', id as string), {
        status: 'completed',
        deliveryConfirmed: true,
        updatedAt: new Date()
      });
      
      // Update local state
      setOrder({
        ...order,
        status: 'completed',
        deliveryConfirmed: true,
        updatedAt: new Date()
      });
      
      toast.success('Order marked as delivered');
      setShowConfirmDeliveryDialog(false);
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error('Failed to update order status');
    } finally {
      setIsConfirmingDelivery(false);
    }
  };
  
  // Function for seller to mark a pickup order as completed
  const handleCompletePickup = async () => {
    if (!order || !id) return;
    
    try {
      setIsCompletingPickup(true);
      console.log('Completing pickup for order:', id, 'by user:', user?.uid);
      
      // Call the API to complete the pickup
      const response = await fetch('/api/orders/complete-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: id,
          userId: user?.uid,
        }),
      });
      
      console.log('API response status:', response.status);
      const data = await response.json();
      console.log('API response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to complete pickup');
      }
      
      // Update local state
      setOrder({
        ...order,
        status: 'completed',
        pickupCompleted: true,
        pickupCompletedAt: new Date(),
        updatedAt: new Date()
      });
      
      toast.success('Pickup completed successfully! The buyer can now leave a review for this transaction.');
      setShowCompletePickupDialog(false);
      
    } catch (error) {
      console.error('Error completing pickup:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete pickup');
    } finally {
      setIsCompletingPickup(false);
    }
  };
  
  // Function for buyer to pay for a pending order
  const handlePayForPendingOrder = async () => {
    if (!order || !id || !user) return;
    
    try {
      setIsProcessingPayment(true);
      console.log('Processing payment for pending order:', id, 'by user:', user.uid);
      
      // Get user email
      const { db } = getFirebaseServices();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const email = userDoc.exists() ? userDoc.data().email : user.email;
      
      if (!email) {
        throw new Error('User email not found');
      }
      
      // Call the API to create a payment session
      const response = await fetch('/api/stripe/connect/create-pending-order-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: id,
          userId: user.uid,
          email,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment session');
      }
      
      // Redirect to Stripe Checkout
      const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
      const stripe = await stripePromise;
      
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }
      
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to redirect to checkout');
      }
      
    } catch (error) {
      console.error('Error processing payment for pending order:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process payment');
      setIsProcessingPayment(false);
    }
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

  // Check if order is eligible for refund (for buyers only)
  const isRefundEligible = () => {
    if (!isUserBuyer) return false; // Only buyers can request refunds
    
    // Check if order has been paid
    if (!order.paymentIntentId && !order.paymentSessionId) return false;
    
    // Check if order is already refunded
    if (order.status === 'refunded' || order.status === 'partially_refunded') return false;
    
    // Check if order is cancelled
    if (order.status === 'cancelled') return false;
    
    // Check if this is a pickup order that has been completed
    if (order.isPickup && order.pickupCompleted) return false;
    
    // Check if refund already requested
    if (order.refundStatus && order.refundStatus !== 'none') return false;
    
    // Check refund deadline (30 days from order creation)
    const refundDeadline = addDays(order.createdAt, 30);
    if (new Date() > refundDeadline) return false;
    
    return true;
  };

  // Function to handle refund request
  const handleRefundRequest = () => {
    setShowRefundDialog(true);
  };

  // Function to handle when refund is requested
  const handleRefundRequested = () => {
    // Refresh the page to show updated status
    router.reload();
  };

  // Function to handle manage refund for sellers
  const handleManageRefund = () => {
    setShowRefundManagementDialog(true);
  };

  // Function to handle when refund is processed
  const handleRefundProcessed = () => {
    // Refresh the page to show updated status
    router.reload();
  };

  // Function to handle relisting after successful refund
  const handleRelistItem = async () => {
    if (!order?.listingSnapshot) {
      toast.error('Unable to relist: listing information not available');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to relist items');
      return;
    }

    try {
      console.log('OrderDetails: Relisting item from order:', order.id);
      console.log('OrderDetails: User UID:', user.uid);

      // Get the user's ID token for authentication
      console.log('OrderDetails: Getting fresh ID token...');
      const token = await user.getIdToken(true); // Force refresh
      console.log('OrderDetails: Token obtained, length:', token.length);

      console.log('OrderDetails: Making API request to relist endpoint');
      const response = await fetch('/api/listings/relist-from-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          idToken: token,
        }),
      });

      console.log('OrderDetails: API response status:', response.status);
      const data = await response.json();
      console.log('OrderDetails: API response data:', data);

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to relist item');
      }

      toast.success('Item successfully relisted! You can find it in your active listings.');
      
      // Optionally redirect to the dashboard to see the new listing
      router.push('/dashboard');

    } catch (error) {
      console.error('OrderDetails: Error relisting item:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to relist item');
    }
  };

  // Check if order is eligible for relisting (for sellers with completed refunds)
  const isRelistEligible = () => {
    console.log('Relist eligibility check:', {
      isUserBuyer,
      refundStatus: order.refundStatus,
      orderStatus: order.status,
      sellerId: order.sellerId,
      currentUserId: user?.uid,
      eligible: !isUserBuyer && order.refundStatus === 'completed'
    });
    
    if (isUserBuyer) return false; // Only sellers can relist
    
    // Check if refund was completed successfully
    if (order.refundStatus !== 'completed') return false;
    
    return true;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
          </Button>
          <Badge
            variant={
              order.status === 'completed' ? 'default' : 
              order.status === 'paid' ? 'success' :
              order.status === 'awaiting_shipping' ? 'warning' :
              order.status === 'shipped' ? 'info' :
              order.status === 'cancelled' ? 'destructive' : 
              'secondary'
            }
            className="text-sm"
          >
            {order.status === 'awaiting_shipping' 
              ? (!order.shippingAddress ? 'Requires Shipping Details' : 'Awaiting Shipping')
              : order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
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
              <div 
                className="relative w-full md:w-1/3 h-48 md:h-64 cursor-pointer"
                onClick={() => {
                  if (order.listingId && order.listingSnapshot) {
                    // Use the new slug-based URL format
                    const listingUrl = generateListingUrl(
                      order.listingSnapshot.title || 'Unknown Listing',
                      order.listingSnapshot.game || 'other',
                      order.listingId
                    );
                    router.push(listingUrl);
                  } else if (order.listingId) {
                    // Fallback to old format if we don't have listing snapshot data
                    router.push(`/listings/${order.listingId}`);
                  }
                }}
              >
                {order.listingSnapshot?.imageUrl ? (
                  <Image
                    src={order.listingSnapshot.imageUrl}
                    alt={order.listingSnapshot.title || 'Order item'}
                    fill
                    className="object-cover rounded-lg hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center hover:bg-muted/80 transition-colors">
                    <span className="text-muted-foreground">No image available</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 
                  className="text-xl font-semibold mb-4 hover:text-primary cursor-pointer"
                  onClick={() => {
                    if (order.listingId && order.listingSnapshot) {
                      // Use the new slug-based URL format
                      const listingUrl = generateListingUrl(
                        order.listingSnapshot.title || 'Unknown Listing',
                        order.listingSnapshot.game || 'other',
                        order.listingId
                      );
                      router.push(listingUrl);
                    } else if (order.listingId) {
                      // Fallback to old format if we don't have listing snapshot data
                      router.push(`/listings/${order.listingId}`);
                    }
                  }}
                >
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
                      {isUserBuyer 
                        ? (
                          <>
                            You purchased from:{' '}
                            <UserNameLink 
                              userId={order.sellerId} 
                              initialUsername={sellerName || undefined} 
                              className="hover:text-primary"
                            />
                          </>
                        )
                        : (
                          <>
                            Sold to:{' '}
                            <UserNameLink 
                              userId={order.buyerId} 
                              initialUsername={buyerName || undefined} 
                              className="hover:text-primary"
                            />
                          </>
                        )
                      }
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
                    {order.originalListingPrice !== undefined && order.offerPrice !== undefined ? (
                      <div className="flex justify-between">
                        <span>Original Listing Price:</span>
                        <span className="text-muted-foreground line-through">{formatPrice(order.originalListingPrice)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>Item Price:</span>
                        <span>{formatPrice(order.listingSnapshot?.price || order.amount)}</span>
                      </div>
                    )}
                    {order.offerPrice !== undefined && (
                      <div className="flex justify-between">
                        <span>Accepted Offer Price:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{formatPrice(order.offerPrice)}</span>
                      </div>
                    )}
                    {order.platformFee !== undefined && (
                      <div className="flex justify-between">
                        <span>Platform Fee:</span>
                        <span>{formatPrice(order.platformFee)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>{formatPrice(order.amount || (order.offerPrice || 0))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Information */}
            {order.isPickup ? (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Information
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <p>This is a local pickup order. No shipping address is required.</p>
                    </div>
                    <div className="mt-4">
                      <p className="font-medium">Local Pickup</p>
                      <p className="mt-1">To be arranged with seller</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Contact the {isUserBuyer ? 'seller' : 'buyer'} to arrange pickup details.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : order.shippingAddress ? (
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
                    {isUserBuyer && (
                      <div className="mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowShippingInfoDialog(true)}
                        >
                          <MapPin className="mr-2 h-4 w-4" /> Update Shipping Information
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Information
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-4 p-6 text-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-medium mb-2">Shipping Information Required</h4>
                        <p className="text-muted-foreground mb-4">
                          To be provided by buyer
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Address pending
                        </p>
                      </div>
                      {isUserBuyer && (
                        <div className="w-full flex flex-col gap-2">
                          <Button 
                            variant="default" 
                            onClick={() => setShowShippingInfoDialog(true)}
                            className="w-full sm:w-auto"
                          >
                            <MapPin className="mr-2 h-4 w-4" /> Provide Shipping Information
                          </Button>
                          
                          {order.sellerHasStripeAccount && (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 w-full text-left">
                              <Info className="h-4 w-4 flex-shrink-0" />
                              <p>After providing shipping information, you'll be redirected to complete payment.</p>
                            </div>
                          )}
                        </div>
                      )}
                      {!isUserBuyer && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 w-full">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <p>Waiting for buyer to provide shipping information.</p>
                        </div>
                      )}
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
                  {order.isPickup && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 mb-4">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <p>For local pickup orders, payment details are handled directly between buyer and seller at the time of pickup.</p>
                    </div>
                  )}
                  
                  {/* Payment button for pending orders with Stripe Connect sellers */}
                  {!order.isPickup && order.sellerHasStripeAccount && !order.paymentSessionId && !order.paymentIntentId && isUserBuyer && order.shippingAddress && order.status === 'pending' && (
                    <div className="flex flex-col gap-3 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <p className="font-medium">Payment Required</p>
                      </div>
                      <p>
                        This seller requires payment before shipping. Please complete your payment to proceed with the order.
                      </p>
                      <div className="mt-1">
                        <Button 
                          variant="default" 
                          className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white"
                          onClick={handlePayForPendingOrder}
                          disabled={isProcessingPayment}
                        >
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="mr-2 h-4 w-4" /> Pay Now
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Payment button for orders that need shipping info first */}
                  {!order.isPickup && order.sellerHasStripeAccount && !order.paymentSessionId && !order.paymentIntentId && isUserBuyer && !order.shippingAddress && (
                    <div className="flex flex-col gap-3 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <p className="font-medium">Payment Required</p>
                      </div>
                      <p>
                        This seller requires payment before shipping. Please provide shipping information to proceed with payment.
                      </p>
                      <div className="mt-1">
                        <Button 
                          variant="default" 
                          className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white"
                          onClick={() => setShowShippingInfoDialog(true)}
                        >
                          <CreditCard className="mr-2 h-4 w-4" /> Provide Shipping Info
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!order.isPickup && !order.sellerHasStripeAccount && !order.paymentSessionId && !order.paymentIntentId && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 mb-4">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <p>Payment will be arranged directly with the seller for this order.</p>
                    </div>
                  )}
                  
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
                    {order.paymentStatus && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Status:</span>
                        <Badge variant={order.paymentStatus === 'paid' || order.paymentStatus === 'succeeded' ? 'success' : 'warning'}>
                          {order.paymentStatus === 'paid' || order.paymentStatus === 'succeeded' ? 'Payment Successful' : 
                           order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                        </Badge>
                      </div>
                    )}
                    {/* Display payment method details for buyers only */}
                    {isUserBuyer && order.paymentMethod && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Method:</span>
                        <span>
                          {order.paymentMethod.brand && order.paymentMethod.last4 && 
                            `${order.paymentMethod.brand.charAt(0).toUpperCase() + order.paymentMethod.brand.slice(1)} •••• ${order.paymentMethod.last4}`}
                        </span>
                      </div>
                    )}
                    {order.isPickup && !order.paymentSessionId && !order.paymentIntentId && (
                      <div className="text-center text-muted-foreground py-2">
                        No online payment information available for local pickup orders.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Refund Status Section - Show when there's refund activity */}
            {order.refundStatus && order.refundStatus !== 'none' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Refund Status
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            order.refundStatus === 'completed' ? 'success' :
                            order.refundStatus === 'failed' ? 'destructive' :
                            order.refundStatus === 'cancelled' ? 'secondary' :
                            'warning'
                          }
                          className="px-2 py-1"
                        >
                          {order.refundStatus === 'completed' ? 'Refund Completed' :
                           order.refundStatus === 'failed' ? 'Refund Failed' :
                           order.refundStatus === 'cancelled' ? 'Refund Denied' :
                           order.refundStatus === 'requested' ? 'Refund Requested' :
                           'Refund Pending'}
                        </Badge>
                        <span>
                          {order.refundStatus === 'completed' ? 'The refund has been processed successfully.' :
                           order.refundStatus === 'failed' ? 'The refund attempt failed and can be retried.' :
                           order.refundStatus === 'cancelled' ? 'The refund request was denied by the seller.' :
                           order.refundStatus === 'requested' ? 'A refund has been requested and is awaiting seller review.' :
                           'Refund status is being processed.'}
                        </span>
                      </div>

                      {/* Show refund details */}
                      {order.refundRequestedAt && (
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Requested:</span>
                            <span>{format(order.refundRequestedAt.toDate ? order.refundRequestedAt.toDate() : new Date(order.refundRequestedAt), 'PPp')}</span>
                          </div>
                          {order.refundAmount && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Refund Amount:</span>
                              <span className="font-semibold">{formatPrice(order.refundAmount)}</span>
                            </div>
                          )}
                          {order.refundReason && (
                            <div>
                              <span className="text-muted-foreground block mb-1">Reason:</span>
                              <p className="text-sm bg-background p-2 rounded border">
                                {order.refundReason}
                              </p>
                            </div>
                          )}
                          {order.refundNotes && (
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                {order.refundStatus === 'failed' ? 'Failure Reason:' : 'Notes:'}
                              </span>
                              <p className={`text-sm bg-background p-2 rounded border ${
                                order.refundStatus === 'failed' ? 'text-red-600 dark:text-red-400' : ''
                              }`}>
                                {order.refundNotes}
                              </p>
                            </div>
                          )}
                          {order.refundProcessedAt && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Processed:</span>
                              <span>{format(order.refundProcessedAt.toDate ? order.refundProcessedAt.toDate() : new Date(order.refundProcessedAt), 'PPp')}</span>
                            </div>
                          )}
                          {order.refundId && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Refund ID:</span>
                              <span className="font-mono text-sm">{order.refundId}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show retry information for failed refunds */}
                      {order.refundStatus === 'failed' && !isUserBuyer && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Refund Failed</p>
                            <p className="mt-1">
                              The refund attempt failed. You can retry the refund process or deny the request.
                              Click the "Retry Refund" button below to try again.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Contact Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Contact & Support
              </h3>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact the other party */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact {isUserBuyer ? 'Seller' : 'Buyer'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Need to discuss order details, pickup arrangements, or have questions about this transaction?
                      </p>
                      {order && (
                        <MessageDialog
                          recipientId={isUserBuyer ? order.sellerId : order.buyerId}
                          recipientName={isUserBuyer ? (sellerName || 'Seller') : (buyerName || 'Buyer')}
                          listingId={order.listingId}
                          listingTitle={order.listingSnapshot?.title}
                        />
                      )}
                    </div>

                    {/* Contact Support */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Contact Support
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Having issues with your order, payment problems, or need help with disputes?
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => router.push('/support')}
                      >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Get Support
                      </Button>
                    </div>
                  </div>

                  {/* Additional contact info for specific situations */}
                  {order.isPickup && (
                    <div className="mt-4 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Local Pickup Coordination</p>
                          <p className="mt-1 text-sm">
                            Use the message feature above to coordinate pickup times, locations, and any special instructions with the {isUserBuyer ? 'seller' : 'buyer'}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(order.refundStatus === 'requested' || order.refundStatus === 'failed') && (
                    <div className="mt-4 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Refund in Progress</p>
                          <p className="mt-1 text-sm">
                            If you need assistance with the refund process or have questions about the refund status, please contact support.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Shipping/Pickup Status Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                {order.isPickup ? (
                  <>
                    <MapPin className="h-5 w-5" />
                    Pickup Status
                  </>
                ) : (
                  <>
                    <Truck className="h-5 w-5" />
                    Shipping Status
                  </>
                )}
              </h3>
              <Card>
                <CardContent className="pt-6">
                  {order.isPickup ? (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                        <Badge 
                          variant={order.status === 'completed' ? 'success' : 'warning'} 
                          className={`px-2 py-1 inline-flex ${
                            order.status === 'completed' 
                              ? 'bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800' 
                              : 'bg-yellow-100 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800'
                          }`}
                        >
                          {order.status === 'completed' ? 'Pickup Completed' : 'Awaiting Pickup'}
                        </Badge>
                        <span className="flex-1">
                          {order.status === 'completed' 
                            ? 'This item has been picked up by the buyer.' 
                            : 'This item is ready for pickup.'}
                        </span>
                        
                        {/* Complete Pickup Button - Only visible to seller and when not completed */}
                        {!isUserBuyer && !order.pickupCompleted && (order.status === 'paid' || order.status === 'awaiting_shipping') && (
                          <Button 
                            variant="default" 
                            size="sm"
                            className="mt-2 sm:mt-0 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium"
                            onClick={() => setShowCompletePickupDialog(true)}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" /> Complete Pickup
                          </Button>
                        )}
                      </div>
                      
                      {order.pickupCompleted && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 mt-2">
                          <CheckCircle className="h-4 w-4 flex-shrink-0" />
                          <p>
                            Pickup was completed on {order.pickupCompletedAt && 
                              (typeof order.pickupCompletedAt === 'object' && 'seconds' in order.pickupCompletedAt
                                ? format(new Date(order.pickupCompletedAt.seconds * 1000), 'PPP')
                                : format(new Date(order.pickupCompletedAt), 'PPP')
                              )}
                          </p>
                        </div>
                      )}
                      
                      {!order.pickupCompleted && (order.status === 'paid' || order.status === 'awaiting_shipping') && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 mt-2">
                          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Local Pickup Instructions</p>
                            <p className="mt-1">Contact the {isUserBuyer ? 'seller' : 'buyer'} to arrange a pickup time and location.</p>
                            {!isUserBuyer ? (
                              <div className="mt-2 border-t border-blue-200 dark:border-blue-800 pt-2">
                                <p className="font-medium flex items-center">
                                  <CheckCircle className="h-4 w-4 mr-1" /> Seller Action Required
                                </p>
                                <p className="mt-1">
                                  Once the buyer has picked up the item, click the "Complete Pickup" button to mark this order as completed.
                                  This will allow the buyer to leave a review for this transaction.
                                </p>
                                <div className="mt-3">
                                  <Button 
                                    variant="primary" 
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => setShowCompletePickupDialog(true)}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" /> Complete Pickup
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 border-t border-blue-200 dark:border-blue-800 pt-2">
                                <p className="font-medium flex items-center">
                                  <Info className="h-4 w-4 mr-1" /> Next Steps
                                </p>
                                <p className="mt-1">
                                  After you pick up the item, the seller will mark the order as completed.
                                  You'll then be able to leave a review for this transaction.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : order.status === 'shipped' || order.status === 'completed' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={order.status === 'completed' ? 'success' : 'info'} 
                          className={`px-2 py-1 ${
                            order.status === 'completed' 
                              ? 'bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800' 
                              : 'bg-blue-100 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {order.status === 'completed' ? 'Delivered' : 'Shipped'}
                        </Badge>
                        <span>
                          {order.status === 'completed' 
                            ? 'This order has been delivered.' 
                            : 'This order has been shipped.'}
                        </span>
                      </div>
                      
                      {/* Tracking Information */}
                      {order.trackingInfo ? (
                        <div className="space-y-4 mt-4">
                          <div className="border rounded-lg p-4 bg-card">
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground font-medium">Carrier:</span>
                                  <Badge variant="outline" className="font-semibold">
                                    {order.trackingInfo.carrier}
                                  </Badge>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                  {/* Update Tracking Button - Only visible to seller */}
                                  {!isUserBuyer && order.status !== 'completed' && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setCarrier(order.trackingInfo?.carrier || '');
                                        setTrackingNumber(order.trackingInfo?.trackingNumber || '');
                                        setTrackingNotes(order.trackingInfo?.notes || '');
                                        setShowTrackingDialog(true);
                                      }}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Update Tracking
                                    </Button>
                                  )}
                                  
                                  {/* Removed redundant 'track package' button as requested */}
                                </div>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <span className="text-muted-foreground font-medium">Tracking Number:</span>
                                  <code className="bg-muted px-2 py-1 rounded font-mono text-foreground text-sm break-all">
                                    {order.trackingInfo.trackingNumber}
                                  </code>
                                </div>
                                
                                {/* Copy Tracking Button with Tooltip */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="mt-1 sm:mt-0 self-start sm:self-auto"
                                        onClick={() => {
                                          try {
                                            const trackingNumber = order.trackingInfo?.trackingNumber || '';
                                            navigator.clipboard.writeText(trackingNumber)
                                              .then(() => {
                                                // Show a toast notification to confirm the copy action
                                                toast.success('Tracking number copied to clipboard', {
                                                  duration: 3000,
                                                  position: 'bottom-center',
                                                  icon: <Copy className="h-4 w-4" />
                                                });
                                              })
                                              .catch((err) => {
                                                console.error('Failed to copy tracking number:', err);
                                                toast.error('Failed to copy tracking number');
                                              });
                                          } catch (error) {
                                            console.error('Error copying tracking number:', error);
                                            toast.error('Failed to copy tracking number');
                                          }
                                        }}
                                      >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Copy tracking number to clipboard</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              
                              {order.trackingInfo.notes && (
                                <div className="mt-2">
                                  <span className="text-muted-foreground font-medium">Notes:</span>
                                  <p className="mt-1 text-sm p-2 bg-muted rounded text-foreground">
                                    {order.trackingInfo.notes}
                                  </p>
                                </div>
                              )}
                              
                              <div className="text-sm text-muted-foreground mt-2">
                                Tracking added on {order.trackingInfo.addedAt && 
                                  (typeof order.trackingInfo.addedAt === 'object' && 'seconds' in order.trackingInfo.addedAt
                                    ? format(new Date(order.trackingInfo.addedAt.seconds * 1000), 'PPP')
                                    : format(new Date(order.trackingInfo.addedAt), 'PPP')
                                  )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Live Tracking Status */}
                          {order.trackingInfo.carrier && order.trackingInfo.trackingNumber && (
                            <div className="mt-4">
                              <h4 className="text-sm font-medium mb-2">Live Tracking Status</h4>
                              <TrackingStatusComponent 
                                carrier={order.trackingInfo.carrier} 
                                trackingNumber={order.trackingInfo.trackingNumber} 
                              />
                            </div>
                          )}
                        </div>
                      ) : order.noTrackingConfirmed ? (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <p>This order was marked as shipped without tracking information.</p>
                        </div>
                      ) : null}
                    </div>
                  ) : order.status === 'awaiting_shipping' || order.status === 'paid' ? (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <Clock className="h-4 w-4" />
                      <p>This order is awaiting shipment.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <p>Shipping information will appear here once the order is processed.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 sm:justify-between">
            <Button onClick={handleBack} variant="outline" className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
            </Button>
            
            {/* Seller shipping actions for regular orders */}
            {!isUserBuyer && !order.isPickup && (order.status === 'paid' || order.status === 'awaiting_shipping') && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => setShowTrackingDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Truck className="mr-2 h-4 w-4" /> Add Tracking
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowNoTrackingDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Package className="mr-2 h-4 w-4" /> Complete Without Tracking
                </Button>
              </div>
            )}
            
            {/* Seller actions for pickup orders */}
            {!isUserBuyer && order.isPickup && !order.pickupCompleted && (
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700 text-white font-medium"
                onClick={() => setShowCompletePickupDialog(true)}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Complete Pickup
              </Button>
            )}
            
            {/* Buyer and Seller actions */}
            <div className="flex gap-2">
              {/* Buyer actions */}
              {isUserBuyer && order.status === 'completed' && !order.reviewSubmitted && (
                <Button 
                  variant="primary" 
                  onClick={() => setShowReviewDialog(true)}
                >
                  <Star className="mr-2 h-4 w-4" /> Leave Review
                </Button>
              )}
              {isUserBuyer && order.status === 'completed' && order.reviewSubmitted && (
                <Button variant="outline" onClick={() => toast.info('Contact support for any issues with this order')}>
                  <Package className="mr-2 h-4 w-4" /> Report Issue
                </Button>
              )}

              {/* Relist Button - Only visible for buyers with completed refunds */}
              {isRelistEligible() && (
                <Button 
                  variant="outline" 
                  className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                  onClick={handleRelistItem}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Relist Item
                </Button>
              )}
              
              {/* Request Refund Button - Only visible for buyers with eligible orders */}
              {isRefundEligible() && (
                <Button 
                  variant="outline" 
                  className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  onClick={handleRefundRequest}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Request Refund
                </Button>
              )}

              {/* Manage Refund Button - Only visible for sellers when refund is requested or failed */}
              {!isUserBuyer && (order.refundStatus === 'requested' || order.refundStatus === 'failed') && (
                <Button 
                  variant="outline" 
                  className={
                    order.refundStatus === 'failed'
                      ? "border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  }
                  onClick={handleManageRefund}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {order.refundStatus === 'failed' ? 'Retry Refund' : 'Manage Refund'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Add Tracking Information Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Tracking Information</DialogTitle>
            <DialogDescription>
              Enter the shipping carrier and tracking number for this order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="carrier">Shipping Carrier (Optional)</Label>
                <span className="text-xs text-muted-foreground">Will be auto-detected if left empty</span>
              </div>
              <Input
                id="carrier"
                placeholder="USPS, FedEx, UPS, etc."
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
              {trackingNumber && !carrier && (
                <p className="text-xs text-blue-600 mt-1">
                  Carrier will be auto-detected from tracking number
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingNotes">Additional Notes (Optional)</Label>
              <Textarea
                id="trackingNotes"
                placeholder="Any additional information about the shipment"
                value={trackingNotes}
                onChange={(e) => setTrackingNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTracking} 
              disabled={!trackingNumber || isUpdatingShipping}
            >
              {isUpdatingShipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Tracking Information
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Shipped Without Tracking Dialog */}
      <AlertDialog open={showNoTrackingDialog} onOpenChange={setShowNoTrackingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Order Without Tracking?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to mark this order as completed without providing tracking information. 
              This means you will have no proof of delivery in case of disputes.
              The order status will be changed to "Completed" immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkAsShipped}
              disabled={isUpdatingShipping}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isUpdatingShipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Confirm Delivery Dialog removed as it's no longer needed */}
      
      {/* Complete Pickup Dialog */}
      <AlertDialog open={showCompletePickupDialog} onOpenChange={setShowCompletePickupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Pickup</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                By marking this order as completed, you confirm that the buyer has picked up the item.
              </p>
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 mt-2">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">What happens next?</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                    <li>The order will be marked as completed</li>
                    <li>The buyer will be able to leave a review for this transaction</li>
                    <li>The review will be visible on your seller profile</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCompletePickup}
              disabled={isCompletingPickup}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompletingPickup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Pickup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>
              Share your experience with this seller and help other buyers make informed decisions.
            </DialogDescription>
          </DialogHeader>
          {order && (
            <ReviewForm 
              orderId={order.id} 
              onSuccess={() => {
                setShowReviewDialog(false);
                // Update local state to reflect that a review has been submitted
                setOrder({
                  ...order,
                  reviewSubmitted: true
                });
              }}
              onCancel={() => setShowReviewDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Shipping Info Dialog */}
      {order && (
        <OrderShippingInfoDialog
          open={showShippingInfoDialog}
          onOpenChange={setShowShippingInfoDialog}
          orderId={order.id}
          onComplete={(shippingAddress) => {
            // Update local state with the new shipping address
            setOrder({
              ...order,
              shippingAddress
            });
            toast.success('Shipping information updated successfully');
          }}
        />
      )}

      {/* Refund Request Dialog */}
      {order && (
        <RefundRequestDialog
          open={showRefundDialog}
          onOpenChange={setShowRefundDialog}
          order={order}
          onRefundRequested={handleRefundRequested}
        />
      )}

      {/* Refund Management Dialog */}
      {order && (
        <RefundManagementDialog
          open={showRefundManagementDialog}
          onOpenChange={setShowRefundManagementDialog}
          order={order}
          onRefundProcessed={handleRefundProcessed}
        />
      )}
    </DashboardLayout>
  );
}