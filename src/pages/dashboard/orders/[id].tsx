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
import { PickupQRCode } from '@/components/PickupQRCode';
import { generateListingUrl } from '@/lib/listing-slug';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import BuyerCompleteOrderButton from '@/components/BuyerCompleteOrderButton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
  const [isConfirmingBuyerPickup, setIsConfirmingBuyerPickup] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [showNoTrackingDialog, setShowNoTrackingDialog] = useState(false);
  const [showConfirmDeliveryDialog, setShowConfirmDeliveryDialog] = useState(false);
  const [showBuyerPickupDialog, setShowBuyerPickupDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showShippingInfoDialog, setShowShippingInfoDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showRefundManagementDialog, setShowRefundManagementDialog] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

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
        setError(null);
        
        // Ensure we have a fresh authentication token
        let token;
        try {
          token = await user.getIdToken(true);
          console.log('[OrderDetails] Got fresh authentication token');
        } catch (tokenError) {
          console.error('[OrderDetails] Failed to get authentication token:', tokenError);
          setError('Authentication failed. Please sign in again.');
          setLoading(false);
          return;
        }

        const { db } = getFirebaseServices();
        
        // Add retry logic for the order fetch
        let orderDoc;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`[OrderDetails] Fetching order (attempt ${retryCount + 1}/${maxRetries})`);
            orderDoc = await getDoc(doc(db, 'orders', id as string));
            break; // Success, exit retry loop
          } catch (fetchError: any) {
            console.error(`[OrderDetails] Error fetching order (attempt ${retryCount + 1}):`, fetchError);
            
            if (fetchError.code === 'permission-denied' || fetchError.code === 'unauthenticated') {
              // Authentication issue - try to refresh token
              try {
                await user.getIdToken(true);
                console.log('[OrderDetails] Refreshed token after auth error');
              } catch (refreshError) {
                console.error('[OrderDetails] Failed to refresh token:', refreshError);
                setError('Authentication failed. Please sign in again.');
                setLoading(false);
                return;
              }
            }
            
            retryCount++;
            if (retryCount >= maxRetries) {
              throw fetchError; // Re-throw the last error
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
        
        if (!orderDoc || !orderDoc.exists()) {
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
        
        // Fetch user information after setting the order (with error handling)
        try {
          await fetchUserInfo(orderWithDates.buyerId, orderWithDates.sellerId);
        } catch (userInfoError) {
          console.error('[OrderDetails] Error fetching user info:', userInfoError);
          // Don't fail the entire page if user info fetch fails
          setBuyerName('Unknown User');
          setSellerName('Unknown User');
        }
      } catch (error: any) {
        console.error('[OrderDetails] Error fetching order details:', error);
        
        // Provide more specific error messages
        if (error.code === 'permission-denied') {
          setError('You do not have permission to view this order. Please sign in again.');
        } else if (error.code === 'unauthenticated') {
          setError('Authentication required. Please sign in again.');
        } else if (error.code === 'unavailable') {
          setError('Service temporarily unavailable. Please try again in a moment.');
        } else {
          setError('Failed to load order details. Please try refreshing the page.');
        }
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
      
      // Add retry logic for user info fetching
      const fetchUserWithRetry = async (userId: string, userType: 'buyer' | 'seller') => {
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount < maxRetries) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const name = userData.displayName || userData.username || 'Unknown User';
              console.log(`[OrderDetails] Found ${userType} name: ${name}`);
              return name;
            } else {
              console.warn(`[OrderDetails] ${userType} document not found for ${userType}Id: ${userId}`);
              return 'Unknown User';
            }
          } catch (fetchError: any) {
            console.error(`[OrderDetails] Error fetching ${userType} info (attempt ${retryCount + 1}):`, fetchError);
            
            if (fetchError.code === 'permission-denied' || fetchError.code === 'unauthenticated') {
              // Authentication issue - don't retry, just return unknown
              console.warn(`[OrderDetails] Authentication error fetching ${userType} info, using fallback`);
              return 'Unknown User';
            }
            
            retryCount++;
            if (retryCount >= maxRetries) {
              console.error(`[OrderDetails] Failed to fetch ${userType} info after ${maxRetries} attempts`);
              return 'Unknown User';
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          }
        }
        
        return 'Unknown User';
      };
      
      // Fetch buyer and seller info concurrently with error handling
      const [buyerName, sellerName] = await Promise.allSettled([
        fetchUserWithRetry(buyerId, 'buyer'),
        fetchUserWithRetry(sellerId, 'seller')
      ]);
      
      setBuyerName(buyerName.status === 'fulfilled' ? buyerName.value : 'Unknown User');
      setSellerName(sellerName.status === 'fulfilled' ? sellerName.value : 'Unknown User');
      
    } catch (error: any) {
      console.error('[OrderDetails] Error in fetchUserInfo:', error);
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
    if (!order || !id) return;
    
    // For mobile users, use native HTML prompts
    if (isMobile) {
      const trackingNumberInput = window.prompt('Enter tracking number:');
      if (!trackingNumberInput || trackingNumberInput.trim() === '') {
        return; // User cancelled or entered empty value
      }
      
      const carrierInput = window.prompt('Enter shipping carrier (optional - leave empty for auto-detection):', '') || '';
      const notesInput = window.prompt('Enter additional notes (optional):', '') || '';
      
      try {
        setIsUpdatingShipping(true);
        const { db } = getFirebaseServices();
        
        const carrierValue = carrierInput.trim() || 'auto-detect';
        
        // Update the order with tracking information
        await updateDoc(doc(db, 'orders', id as string), {
          status: 'shipped',
          trackingInfo: {
            carrier: carrierValue,
            trackingNumber: trackingNumberInput.trim(),
            notes: notesInput.trim(),
            addedAt: new Date(),
            addedBy: user?.uid,
            autoDetect: !carrierInput.trim()
          },
          trackingRequired: true,
          updatedAt: new Date()
        });
        
        // Update local state
        setOrder({
          ...order,
          status: 'shipped',
          trackingInfo: {
            carrier: carrierValue,
            trackingNumber: trackingNumberInput.trim(),
            notes: notesInput.trim(),
            addedAt: new Date(),
            addedBy: user?.uid,
            autoDetect: !carrierInput.trim()
          },
          trackingRequired: true,
          updatedAt: new Date()
        });
        
        toast.success('Tracking information added successfully');
      } catch (error) {
        console.error('Error adding tracking information:', error);
        toast.error('Failed to add tracking information');
      } finally {
        setIsUpdatingShipping(false);
      }
      return;
    }
    
    // For desktop users, use the existing dialog
    if (!trackingNumber) return;
    
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
    
    // Check if tracking is required for high-value orders
    if (order.amount >= 99.99) {
      toast.error('Tracking is required for orders over $99.99. Please add tracking information instead.');
      return;
    }
    
    // For mobile users, use native HTML confirm
    if (isMobile) {
      let confirmMessage = 'Complete Order Without Tracking?\n\n';
      
      if (order.amount >= 49.99) {
        confirmMessage += 'WARNING: For orders over $49.99, you are responsible for any shipping issues without tracking. ' +
          'You will have no proof of delivery in case of disputes or lost packages.\n\n';
      } else {
        confirmMessage += 'You are about to mark this order as completed without providing tracking information. ' +
          'This means you will have no proof of delivery in case of disputes.\n\n';
      }
      
      confirmMessage += 'The order status will be changed to "Completed" immediately.\n\n' +
        'Do you want to continue?';
      
      const confirmed = window.confirm(confirmMessage);
      
      if (!confirmed) {
        return; // User cancelled
      }
    }
    
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
      if (!isMobile) {
        setShowNoTrackingDialog(false);
      }
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
  

  
  // Function for buyer to confirm pickup
  const handleConfirmBuyerPickup = async () => {
    if (!order || !id) return;
    
    try {
      setIsConfirmingBuyerPickup(true);
      console.log('Confirming buyer pickup for order:', id, 'by user:', user?.uid);
      
      // Call the API to confirm pickup as buyer
      const response = await fetch('/api/orders/confirm-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: id,
          userId: user?.uid,
          role: 'buyer',
        }),
      });
      
      console.log('API response status:', response.status);
      const data = await response.json();
      console.log('API response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to confirm pickup');
      }
      
      toast.success(data.message);
      
      // Refresh the page to show updated status
      router.reload();
      
    } catch (error) {
      console.error('Error confirming buyer pickup:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to confirm pickup');
    } finally {
      setIsConfirmingBuyerPickup(false);
      setShowBuyerPickupDialog(false);
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

  // Review window calculations (client-side mirror of API enforcement)
  const normalizeDate = (d: any): Date | null => {
    if (!d) return null;
    if (typeof d === 'object' && typeof (d as any).toDate === 'function') return (d as any).toDate();
    if (typeof d === 'object' && 'seconds' in d) return new Date((d as any).seconds * 1000);
    try {
      return new Date(d);
    } catch {
      return null;
    }
  };

  const completionDate =
    normalizeDate(order.buyerCompletedAt) ||
    normalizeDate(order.autoCompletedAt) ||
    normalizeDate(order.pickupCompletedAt) ||
    (order.status === 'completed' ? order.updatedAt : null);

  const reviewWindowEnd = completionDate ? addDays(completionDate, 90) : null;
  const now = new Date();
  const daysLeft = reviewWindowEnd ? Math.max(0, differenceInCalendarDays(reviewWindowEnd, now)) : 0;
  const isWithinReviewWindow = !!(reviewWindowEnd && now < reviewWindowEnd);
  const canLeaveReview =
    isUserBuyer && order.status === 'completed' && !order.reviewSubmitted && isWithinReviewWindow;

  // Render payment status badge
  const renderPaymentStatusBadge = () => {
    const raw = (order.paymentStatus || 'unknown').toString().toLowerCase();
    let colorClasses = 'bg-muted text-foreground';
    switch (raw) {
      case 'pending':
        colorClasses = 'bg-yellow-500 text-white hover:bg-yellow-500/80';
        break;
      case 'paid':
      case 'succeeded':
        colorClasses = 'bg-green-600 text-white hover:bg-green-600/80';
        break;
      case 'failed':
      case 'canceled':
      case 'cancelled':
        colorClasses = 'bg-red-600 text-white hover:bg-red-600/80';
        break;
      case 'refunded':
        colorClasses = 'bg-blue-600 text-white hover:bg-blue-600/80';
        break;
      default:
        colorClasses = 'bg-muted text-foreground';
    }
    const text =
      raw === 'succeeded' ? 'Paid' : raw.charAt(0).toUpperCase() + raw.slice(1);
    const base =
      'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap max-w-full overflow-hidden border-transparent shadow';
    return <div className={`${base} ${colorClasses}`}>{text}</div>;
  };

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

      console.log('OrderDetails: Relist successful, new listing ID:', data.listingId);
      toast.success('Item successfully relisted! Redirecting to your dashboard...');
      
      // Clear any cached listings data to ensure fresh data
      try {
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('listings_')
        );
        
        for (const key of cacheKeys) {
          localStorage.removeItem(key);
          console.log('OrderDetails: Cleared cache:', key);
        }
        
        console.log('OrderDetails: Cleared all listing caches to ensure fresh data');
      } catch (cacheError) {
        console.error('OrderDetails: Error clearing listing caches:', cacheError);
      }
      
      // Add a flag to localStorage to indicate that listings should be refreshed
      localStorage.setItem('force_listings_refresh', 'true');
      localStorage.setItem('relist_success', 'true');
      
      // Redirect to the dashboard to see the new listing
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
              : order.status === 'paid' && order.isPickup
              ? 'Awaiting Pickup'
              : order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
          </Badge>
        </div>

        {/* Shipping Required Banner */}
        {!order.isPickup && order.status === 'awaiting_shipping' && !order.shippingAddress && (
          <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Truck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
                    Shipping Information Required
                  </h3>
                  <p className="text-orange-700 dark:text-orange-300 mb-4">
                    {isUserBuyer 
                      ? "This order requires shipping information before it can be processed. Please provide your shipping address to continue."
                      : "This order is waiting for the buyer to provide shipping information before you can ship the item."
                    }
                  </p>
                  {isUserBuyer && (
                    <Button 
                      variant="default" 
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={() => setShowShippingInfoDialog(true)}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Provide Shipping Information
                    </Button>
                  )}
                  {!isUserBuyer && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <p className="text-sm">
                        The buyer will be notified to provide their shipping address. You'll be able to ship once they complete this step.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seller Shipping Action Banner */}
        {!isUserBuyer && !order.isPickup && order.status === 'awaiting_shipping' && order.shippingAddress && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    Ready to Ship
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 mb-4">
                    The buyer has provided shipping information and this order is ready to be shipped. Please add tracking information or mark as shipped to continue.
                  </p>
                  
                  {/* Tracking requirement warnings based on order value */}
                  {order.amount >= 99.99 && (
                    <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Tracking Required</p>
                          <p className="mt-1 text-sm">
                            Orders over $99.99 require tracking information to protect both buyer and seller. 
                            Shipping without tracking is not available for high-value orders.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {order.amount >= 49.99 && order.amount < 99.99 && (
                    <div className="mb-4 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Tracking Highly Recommended</p>
                          <p className="mt-1 text-sm">
                            For orders over $49.99, you are responsible for any shipping issues if you choose to ship without tracking. 
                            We strongly recommend using tracking to protect yourself from disputes and lost packages.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      variant="default" 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        if (isMobile) {
                          handleAddTracking();
                        } else {
                          setShowTrackingDialog(true);
                        }
                      }}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Add Tracking Information
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      onClick={() => {
                        if (isMobile) {
                          handleMarkAsShipped();
                        } else {
                          setShowNoTrackingDialog(true);
                        }
                      }}
                      disabled={order.amount >= 99.99}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      {order.amount >= 99.99 ? 'Tracking Required' : 'Ship Without Tracking'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Order Details</CardTitle>
            <CardDescription className="text-lg">
              Order ID: <span className="font-mono text-lg">{order.id}</span>
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
                    {renderPaymentStatusBadge()}
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
                        <span>{formatPrice(order.listingSnapshot?.price || (order.offerPrice || order.amount))}</span>
                      </div>
                    )}
                    {order.offerPrice !== undefined && (
                      <div className="flex justify-between">
                        <span>Accepted Offer Price:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{formatPrice(order.offerPrice)}</span>
                      </div>
                    )}
                    {/* Show shipping cost if available */}
                    {(order.shippingCost !== undefined && order.shippingCost > 0) || (order.listingSnapshot?.shippingTerms?.shippingCost !== undefined && (order.listingSnapshot?.shippingTerms?.shippingCost || 0) > 0) ? (
                      <div className="flex justify-between">
                        <span>Shipping:</span>
                        <span>{formatPrice(order.shippingCost || order.listingSnapshot?.shippingTerms?.shippingCost || 0)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>Shipping:</span>
                        <span className="text-green-600 dark:text-green-400">Free</span>
                      </div>
                    )}
                    {/* Only show platform fee to sellers, not buyers */}
                    {!isUserBuyer && order.platformFee !== undefined && (
                      <div className="flex justify-between">
                        <span>Platform Fee (deducted):</span>
                        <span className="text-red-600 dark:text-red-400">
                          -{formatPrice(order.platformFee)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>{isUserBuyer ? 'Total Paid:' : 'Your Earnings:'}</span>
                      <span>
                        {isUserBuyer 
                          ? formatPrice(order.amount)
                          : formatPrice((order.amount || (order.offerPrice || 0)) - (order.platformFee || 0))
                        }
                      </span>
                    </div>
                  </div>

                  {/* Buyer Order Completion Section */}
                  {isUserBuyer && order.paymentStatus === 'paid' && order.status !== 'completed' && (
                    <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Complete Your Order
                      </h4>
                      <p className="text-blue-700 dark:text-blue-300 mb-4 text-sm">
                        Once you've received your item and are satisfied with your purchase, you can mark this order as complete. 
                        This helps us ensure a smooth transaction process and allows you to leave a review.
                      </p>
                      <div className="space-y-3">
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          <strong>Note:</strong> You can complete your order 24 hours after payment to allow time for any shipping or delivery issues to be resolved.
                        </div>
                        <BuyerCompleteOrderButton
                          order={order}
                          onOrderCompleted={() => router.reload()}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pickup Status - Moved to top */}
            {order.isPickup && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Pickup Status
                </h3>
                <Card>
                  <CardContent className="pt-6">
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
                      </div>
                      
                      {/* QR Code Pickup System - Show for both buyer and seller when pickup is not completed */}
                      {!order.pickupCompleted && order.isPickup && (
                        <div className="mt-4 w-full">
                          <PickupQRCode 
                            order={order}
                            isSeller={!isUserBuyer}
                            onPickupCompleted={() => router.reload()}
                          />
                        </div>
                      )}
                      
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
                  </CardContent>
                </Card>
              </div>
            )}

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

            {/* Shipping Status Section - Only for non-pickup orders */}
            {!order.isPickup && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipping Status
                </h3>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Seller-Provided Tracking Information - Always visible */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            Seller-Provided Tracking Information
                          </h4>
                          {!isUserBuyer && (order.status === 'awaiting_shipping' || order.status === 'shipped') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (isMobile) {
                                  handleAddTracking();
                                } else {
                                  setShowTrackingDialog(true);
                                }
                              }}
                            >
                              {order.trackingInfo?.trackingNumber ? 'Update Tracking' : 'Add Tracking'}
                            </Button>
                          )}
                        </div>
                        
                        {order.trackingInfo?.trackingNumber && order.trackingInfo?.carrier ? (
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Carrier:</span>{' '}
                              <span className="text-gray-900 dark:text-gray-100">
                                {order.trackingInfo.carrier.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Tracking Number:</span>{' '}
                              <span className="text-gray-900 dark:text-gray-100 font-mono">
                                {order.trackingInfo.trackingNumber}
                              </span>
                            </div>
                            {order.trackingInfo.notes && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Notes:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">
                                  {order.trackingInfo.notes}
                                </span>
                              </div>
                            )}
                            {order.trackingInfo.addedAt && (
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Added:</span>{' '}
                                <span className="text-gray-900 dark:text-gray-100">
                                  {format(order.trackingInfo.addedAt, 'PPp')}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {!isUserBuyer && (order.status === 'awaiting_shipping' || order.status === 'shipped') 
                              ? 'Click "Add Tracking" to provide tracking information for the buyer.' 
                              : 'Tracking information will be available once provided by the seller.'}
                          </div>
                        )}
                      </div>

                      {/* Live Tracking Status - Only show when tracking info is available */}
                      {order.trackingInfo?.trackingNumber && order.trackingInfo?.carrier && (
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Live Tracking Status
                          </h4>
                          <TrackingStatusComponent 
                            carrier={order.trackingInfo.carrier} 
                            trackingNumber={order.trackingInfo.trackingNumber} 
                          />
                        </div>
                      )}

                      {/* Status message when no tracking is available */}
                      {!order.trackingInfo?.trackingNumber && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Info className="h-4 w-4" />
                          <p>
                            {order.status === 'shipped' || order.status === 'completed'
                              ? 'This order was shipped without tracking information.'
                              : 'Shipping information will appear here once the order is processed.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          {/* Listing snapshot (at time of purchase) */}
          {order.listingSnapshot && (
            <div className="pt-2">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="listing-snapshot">
                  <AccordionTrigger>
                    Listing at time of purchase
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {/* Snapshot images */}
                      {Array.isArray(order.listingSnapshot.images) && order.listingSnapshot.images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {order.listingSnapshot.images.slice(0, 8).map((img, idx) => (
                            <div key={idx} className="relative w-full aspect-square rounded overflow-hidden bg-muted">
                              <Image
                                src={img}
                                alt={`${order.listingSnapshot.title || 'Listing'} - ${idx + 1}`}
                                fill
                                sizes="(max-width: 768px) 50vw, 25vw"
                                className="object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Snapshot facts */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Title</p>
                          <p className="font-medium">{order.listingSnapshot.title}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Seller</p>
                          <p className="font-medium">{order.listingSnapshot.sellerUsername || 'Unknown'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Category / Game</p>
                          <p className="font-medium">
                            {order.listingSnapshot.category || '—'}{order.listingSnapshot.game ? ` / ${order.listingSnapshot.game}` : ''}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Condition</p>
                          <p className="font-medium">{order.listingSnapshot.condition || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Price</p>
                          <p className="font-medium">{formatPrice(order.listingSnapshot.price || 0)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Shipping Terms</p>
                          <p className="font-medium">
                            {order.listingSnapshot.shippingTerms?.isPickup
                              ? 'Local pickup'
                              : order.listingSnapshot.shippingTerms?.shippingCost
                                ? `Buyer pays ${formatPrice(order.listingSnapshot.shippingTerms.shippingCost)}`
                                : 'Free shipping'}
                            {order.listingSnapshot.shippingTerms?.shippingMethod ? ` • ${order.listingSnapshot.shippingTerms.shippingMethod}` : ''}
                          </p>
                          {order.listingSnapshot.shippingTerms?.shippingNotes && (
                            <p className="text-sm text-muted-foreground">{order.listingSnapshot.shippingTerms.shippingNotes}</p>
                          )}
                        </div>
                      </div>

                      {/* Snapshot description */}
                      {order.listingSnapshot.description && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Description</p>
                          <p className="text-sm whitespace-pre-wrap">{order.listingSnapshot.description}</p>
                        </div>
                      )}

                      {/* Snapshot attributes */}
                      {order.listingSnapshot.attributes && Object.keys(order.listingSnapshot.attributes).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Attributes</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(order.listingSnapshot.attributes).slice(0, 12).map(([k, v]) => (
                              <div key={k} className="rounded border p-2">
                                <p className="text-xs text-muted-foreground">{k}</p>
                                <p className="text-sm break-words">
                                  {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                                    ? String(v)
                                    : JSON.stringify(v)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
          </CardContent>
          <CardFooter>
            {isUserBuyer && order.status === 'completed' && (
              <div className={`w-full mb-3 p-3 rounded-md border ${(!order.reviewSubmitted && isWithinReviewWindow) ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200' : (!order.reviewSubmitted && !isWithinReviewWindow) ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/50 text-muted-foreground'}`}>
                <div className="flex items-start gap-2">
                  <Star className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    {!order.reviewSubmitted && isWithinReviewWindow && reviewWindowEnd ? (
                      <>
                        <span className="font-medium">You can leave a review.</span>{' '}
                        <span>Review window ends {format(reviewWindowEnd, 'PPP')} ({daysLeft} day{daysLeft === 1 ? '' : 's'} remaining).</span>
                      </>
                    ) : !order.reviewSubmitted && !isWithinReviewWindow && reviewWindowEnd ? (
                      <>
                        <span className="font-medium">Review window expired.</span>{' '}
                        <span>It ended on {format(reviewWindowEnd, 'PPP')}.</span>
                      </>
                    ) : (
                      <span>Thanks for leaving a review.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 w-full">
              {/* Buyer Complete Order Button - Always show for buyers with paid orders */}
              {isUserBuyer && order.paymentStatus === 'paid' && order.status !== 'completed' && (
                <div className="w-full sm:w-auto">
                  <BuyerCompleteOrderButton
                    order={order}
                    onOrderCompleted={() => router.reload()}
                  />
                </div>
              )}
              
              {/* Buyer actions */}
              {canLeaveReview && (
                <Button 
                  variant="default" 
                  onClick={() => setShowReviewDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Star className="mr-2 h-4 w-4" /> Leave Review
                </Button>
              )}
              {isUserBuyer && order.status === 'completed' && order.reviewSubmitted && (
                <Button 
                  variant="outline" 
                  onClick={() => toast.info('Contact support for any issues with this order')}
                  className="w-full sm:w-auto"
                >
                  <Package className="mr-2 h-4 w-4" /> Report Issue
                </Button>
              )}

              {/* Relist Button - Only visible for sellers with completed refunds */}
              {isRelistEligible() && (
                <Button 
                  variant="outline" 
                  className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 w-full sm:w-auto"
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
                  className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 w-full sm:w-auto"
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
                  className={`w-full sm:w-auto ${
                    order.refundStatus === 'failed'
                      ? "border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  }`}
                  onClick={handleManageRefund}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {order.refundStatus === 'failed' ? 'Retry Refund' : 'Manage Refund'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Contact & Support */}
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

        {/* Back to Orders Button */}
        <div className="flex justify-center">
          <Button onClick={handleBack} variant="outline" className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
          </Button>
        </div>
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
            <AlertDialogDescription className="space-y-3">
              {order && order.amount >= 49.99 && (
                <div className="p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Warning: High-Value Order</p>
                      <p className="mt-1 text-sm">
                        For orders over $49.99, you are responsible for any shipping issues without tracking. 
                        You will have no proof of delivery in case of disputes or lost packages.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <p>
                You are about to mark this order as completed without providing tracking information. 
                {order && order.amount < 49.99 && 'This means you will have no proof of delivery in case of disputes.'}
                The order status will be changed to "Completed" immediately.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkAsShipped}
              disabled={isUpdatingShipping}
              className={order && order.amount >= 49.99 ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700"}
            >
              {isUpdatingShipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {order && order.amount >= 49.99 ? 'Accept Risk & Complete Order' : 'Complete Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Buyer Pickup Confirmation Dialog */}
      <AlertDialog open={showBuyerPickupDialog} onOpenChange={setShowBuyerPickupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Pickup</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                By confirming pickup, you acknowledge that you have received the item from the seller.
              </p>
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 mt-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">What happens next?</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                    <li>Your pickup confirmation will be recorded</li>
                    <li>The seller will also need to confirm pickup</li>
                    <li>Once both parties confirm, the order will be completed</li>
                    <li>You'll then be able to leave a review for this transaction</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmBuyerPickup}
              disabled={isConfirmingBuyerPickup}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConfirmingBuyerPickup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Pickup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Review Dialog - Only show the ReviewForm component which handles mobile/desktop internally */}
      {showReviewDialog && order && (
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
