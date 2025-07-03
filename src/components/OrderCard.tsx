import { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/price';
import { format, addDays } from 'date-fns';
import Image from 'next/image';
import { UserNameLink } from '@/components/UserNameLink';
import { Package, ExternalLink, MapPin, RefreshCw, Plus, AlertTriangle, Clock, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, Loader2, Star, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AcceptedOfferCheckout } from '@/components/AcceptedOfferCheckout';
import { generateListingUrl } from '@/lib/listing-slug';
import { RefundRequestDialog } from '@/components/RefundRequestDialog';
import { RefundManagementDialog } from '@/components/RefundManagementDialog';
import { getOrderAttentionInfo } from '@/lib/order-utils';

interface OrderCardProps {
  order: Order;
  isSale?: boolean;
}

export function OrderCard({ order, isSale = false }: OrderCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(false);
  const [isCompletingPickup, setIsCompletingPickup] = useState(false);
  const [showCompletePickupDialog, setShowCompletePickupDialog] = useState(false);
  const [isConfirmingBuyerPickup, setIsConfirmingBuyerPickup] = useState(false);
  const [showBuyerPickupDialog, setShowBuyerPickupDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showRefundManagementDialog, setShowRefundManagementDialog] = useState(false);
  
  // Fetch user information when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const fetchUserInfo = async () => {
      if (!order.buyerId || !order.sellerId || isLoadingUser) return;
      
      setIsLoadingUser(true);
      try {
        const { db } = getFirebaseServices();
        
        // Only fetch the user we need based on whether this is a sale or purchase
        if (isSale && order.buyerId) {
          const userDoc = await getDoc(doc(db, 'users', order.buyerId));
          if (userDoc.exists() && isMounted) {
            const userData = userDoc.data();
            const name = userData.displayName || userData.username || 'Unknown User';
            setBuyerName(name);
          }
        } else if (!isSale && order.sellerId) {
          const userDoc = await getDoc(doc(db, 'users', order.sellerId));
          if (userDoc.exists() && isMounted) {
            const userData = userDoc.data();
            const name = userData.displayName || userData.username || 'Unknown User';
            setSellerName(name);
          }
        }
      } catch (error) {
        console.error('Error fetching user information:', error);
      } finally {
        if (isMounted) {
          setIsLoadingUser(false);
        }
      }
    };
    
    fetchUserInfo();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [order.buyerId, order.sellerId, isSale, isLoadingUser]);
  
  const handleViewOrder = () => {
    router.push(`/dashboard/orders/${order.id}`);
  };
  
  const handleViewListing = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
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
  };
  
  // Function to handle the complete pickup button click (seller)
  const handleCompletePickup = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setShowCompletePickupDialog(true);
  };
  
  // Function to handle the buyer pickup confirmation button click
  const handleBuyerConfirmPickup = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setShowBuyerPickupDialog(true);
  };
  
  // Function to actually complete the pickup (seller)
  const completePickup = async () => {
    if (!order.id || !user) return;
    
    try {
      setIsCompletingPickup(true);
      console.log('Completing pickup for order:', order.id, 'by user:', user.uid);
      
      // Call the API to complete the pickup
      const response = await fetch('/api/orders/complete-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          userId: user.uid,
        }),
      });
      
      console.log('API response status:', response.status);
      const data = await response.json();
      console.log('API response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to complete pickup');
      }
      
      toast.success('Pickup completed successfully! The buyer can now leave a review for this transaction.');
      
      // Refresh the page to show updated status
      router.reload();
      
    } catch (error) {
      console.error('Error completing pickup:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete pickup');
    } finally {
      setIsCompletingPickup(false);
      setShowCompletePickupDialog(false);
    }
  };
  
  // Function to actually confirm pickup (buyer)
  const confirmBuyerPickup = async () => {
    if (!order.id || !user) return;
    
    try {
      setIsConfirmingBuyerPickup(true);
      console.log('Confirming buyer pickup for order:', order.id, 'by user:', user.uid);
      
      // Call the API to confirm pickup as buyer
      const response = await fetch('/api/orders/confirm-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          userId: user.uid,
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
  
  // Function to handle refund request
  const handleRefundRequest = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering the card click
    console.log('Opening refund dialog for order:', order.id);
    setShowRefundDialog(true);
  };

  // Function to handle when refund is requested
  const handleRefundRequested = () => {
    // Refresh the page to show updated status
    router.reload();
  };

  // Function to handle refund management
  const handleRefundManagement = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setShowRefundManagementDialog(true);
  };

  // Function to handle when refund is processed
  const handleRefundProcessed = () => {
    // Refresh the page to show updated status
    router.reload();
  };

  // Function to handle relisting after successful refund
  const handleRelistItem = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    if (!safeOrder?.listingSnapshot) {
      toast.error('Unable to relist: listing information not available');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to relist items');
      return;
    }

    try {
      console.log('OrderCard: Relisting item from order:', safeOrder.id);
      console.log('OrderCard: User UID:', user.uid);

      // Get the user's ID token for authentication
      console.log('OrderCard: Getting fresh ID token...');
      const token = await user.getIdToken(true); // Force refresh
      console.log('OrderCard: Token obtained, length:', token.length);

      console.log('OrderCard: Making API request to relist endpoint');
      const response = await fetch('/api/listings/relist-from-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: safeOrder.id,
          idToken: token,
        }),
      });

      console.log('OrderCard: API response status:', response.status);
      const data = await response.json();
      console.log('OrderCard: API response data:', data);

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to relist item');
      }

      console.log('OrderCard: Relist successful, new listing ID:', data.listingId);
      toast.success('Item successfully relisted! Redirecting to your dashboard...');
      
      // Clear any cached listings data to ensure fresh data
      try {
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('listings_')
        );
        
        for (const key of cacheKeys) {
          localStorage.removeItem(key);
          console.log('OrderCard: Cleared cache:', key);
        }
        
        console.log('OrderCard: Cleared all listing caches to ensure fresh data');
      } catch (cacheError) {
        console.error('OrderCard: Error clearing listing caches:', cacheError);
      }
      
      // Add a flag to localStorage to indicate that listings should be refreshed
      localStorage.setItem('force_listings_refresh', 'true');
      localStorage.setItem('relist_success', 'true');
      
      // Redirect to the dashboard to see the new listing
      router.push('/dashboard');

    } catch (error) {
      console.error('OrderCard: Error relisting item:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to relist item');
    }
  };

  // Check if order is eligible for refund (for buyers only)
  const isRefundEligible = () => {
    if (isSale) return false; // Sellers can't request refunds
    
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

  // Safety check for order
  if (!order || !order.id) {
    console.warn('OrderCard received invalid order data:', order);
    return null;
  }
  
  // Determine if this is an awaiting payment order (but not for pickup orders)
  const isAwaitingPayment = order.paymentStatus === 'awaiting_payment' && !order.isPickup;
  
  // Ensure we have valid data for the order
  const safeOrder = {
    ...order,
    listingSnapshot: {
      title: order.listingSnapshot?.title || 'Unknown Listing',
      price: order.listingSnapshot?.price || 0,
      imageUrl: order.listingSnapshot?.imageUrl || '',
      game: order.listingSnapshot?.game || 'other',
    },
    createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(),
    // Default to pending if status is missing
    status: isAwaitingPayment ? 'pending' : (order.status || 'pending')
  };

  // Get attention info for this order
  const attentionInfo = getOrderAttentionInfo(safeOrder, isSale);

  // Determine card styling based on attention level - simplified to use single color
  const getCardClassName = () => {
    let baseClass = "mb-4 cursor-pointer hover:shadow-md transition-all duration-200";
    
    if (attentionInfo.needsAttention) {
      return `${baseClass} border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15`;
    }
    
    return baseClass;
  };

  // Get attention icon with priority-based colors
  const getAttentionIcon = () => {
    if (!attentionInfo.needsAttention) return null;
    
    switch (attentionInfo.priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  // Get attention banner styling based on priority
  const getAttentionBannerStyle = () => {
    if (!attentionInfo.needsAttention) return '';
    
    switch (attentionInfo.priority) {
      case 'high':
        return 'border-l-red-600 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'border-l-orange-600 bg-orange-50 dark:bg-orange-900/20';
      case 'low':
        return 'border-l-blue-600 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'border-l-primary bg-primary/10 dark:bg-primary/20';
    }
  };

  // Get attention text color based on priority
  const getAttentionTextColor = () => {
    if (!attentionInfo.needsAttention) return 'text-primary';
    
    switch (attentionInfo.priority) {
      case 'high':
        return 'text-red-700 dark:text-red-300';
      case 'medium':
        return 'text-orange-700 dark:text-orange-300';
      case 'low':
        return 'text-blue-700 dark:text-blue-300';
      default:
        return 'text-primary';
    }
  };

  return (
    <Card className={getCardClassName()} onClick={handleViewOrder}>
      <CardContent className="pt-6">
        {/* Attention Banner */}
        {attentionInfo.needsAttention && (
          <div className={`mb-4 p-3 rounded-lg border-l-4 ${getAttentionBannerStyle()}`}>
            <div className="flex items-start gap-2">
              {getAttentionIcon()}
              <div className="flex-1">
                <p className={`font-medium text-sm ${getAttentionTextColor()}`}>
                  {attentionInfo.reason}
                </p>
                <p className={`text-xs mt-1 ${getAttentionTextColor()} opacity-80`}>
                  {attentionInfo.actionRequired}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          <div className="relative w-24 h-24 md:w-32 md:h-32 md:flex-shrink-0">
            {safeOrder.listingSnapshot.imageUrl ? (
              <Image
                src={safeOrder.listingSnapshot.imageUrl}
                alt={safeOrder.listingSnapshot.title}
                fill
                sizes="(max-width: 640px) 96px, 128px"
                className="object-cover rounded-lg"
                loading="lazy"
                quality={80}
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No image</span>
              </div>
            )}
          </div>
          <div className="flex-1 md:min-h-0">
            <h3 
              className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary" 
              onClick={handleViewListing}
            >
              {safeOrder.listingSnapshot.title}
            </h3>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {isSale ? 'Buyer: ' : 'Seller: '}
                {isSale ? (
                  <UserNameLink userId={safeOrder.buyerId} fallbackName={buyerName || 'Loading...'} />
                ) : (
                  <UserNameLink userId={safeOrder.sellerId} fallbackName={sellerName || 'Loading...'} />
                )}
              </p>
              <p className="text-muted-foreground">
                Date: {format(safeOrder.createdAt, 'PPP')}
              </p>
              <div>
                {safeOrder.offerPrice ? (
                  <div>
                    <p className="font-semibold">{formatPrice(safeOrder.amount || 0)}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Accepted Offer: {formatPrice(safeOrder.offerPrice)}
                    </p>
                  </div>
                ) : (
                  <p className="font-semibold">{formatPrice(safeOrder.amount || 0)}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Show awaiting payment badge as primary status if applicable */}
                {isAwaitingPayment ? (
                  <Badge variant="warning" className="bg-yellow-500 text-white">
                    Awaiting Payment
                  </Badge>
                ) : (
                  <Badge
                    variant={
                      safeOrder.status === 'completed' ? 'default' : 
                      safeOrder.status === 'paid' ? 'success' :
                      safeOrder.status === 'awaiting_shipping' ? 'warning' :
                      safeOrder.status === 'shipped' ? 'info' :
                      safeOrder.status === 'cancelled' ? 'destructive' :
                      safeOrder.status === 'refunded' ? 'destructive' :
                      safeOrder.status === 'partially_refunded' ? 'warning' :
                      'secondary'
                    }
                  >
                    {safeOrder.status === 'awaiting_shipping' 
                      ? (!safeOrder.shippingAddress ? 'Requires Shipping Details' : 'Awaiting Shipping')
                      : safeOrder.status.charAt(0).toUpperCase() + safeOrder.status.slice(1).replace('_', ' ')}
                  </Badge>
                )}
                
                {/* Show refund status badge */}
                {safeOrder.refundStatus && safeOrder.refundStatus !== 'none' && (
                  <Badge 
                    variant={
                      safeOrder.refundStatus === 'requested' ? 'warning' :
                      safeOrder.refundStatus === 'processing' ? 'info' :
                      safeOrder.refundStatus === 'completed' ? 'success' :
                      safeOrder.refundStatus === 'failed' ? 'destructive' :
                      safeOrder.refundStatus === 'cancelled' ? 'destructive' :
                      'secondary'
                    }
                    className={
                      safeOrder.refundStatus === 'requested' ? 'bg-orange-500 text-white' :
                      safeOrder.refundStatus === 'processing' ? 'bg-blue-500 text-white' :
                      safeOrder.refundStatus === 'completed' ? 'bg-green-500 text-white' :
                      safeOrder.refundStatus === 'failed' ? 'bg-red-500 text-white' :
                      safeOrder.refundStatus === 'cancelled' ? 'bg-gray-500 text-white' :
                      ''
                    }
                  >
                    Refund {safeOrder.refundStatus.charAt(0).toUpperCase() + safeOrder.refundStatus.slice(1)}
                  </Badge>
                )}
                
                {/* Show tracking requirement badge */}
                {safeOrder.status === 'shipped' && safeOrder.trackingRequired && !safeOrder.trackingInfo && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                    Tracking Required
                  </Badge>
                )}
                
                {/* Show tracking provided badge */}
                {safeOrder.trackingInfo && (
                  <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300">
                    Tracking Provided
                  </Badge>
                )}
                
                {/* Show no tracking badge */}
                {safeOrder.noTrackingConfirmed && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-300">
                    No Tracking
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-4 md:mt-0 md:flex-shrink-0 md:w-[200px] md:self-start">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                handleViewOrder();
              }}
            >
              <Package className="mr-2 h-4 w-4" />
              View Details
            </Button>
            {safeOrder.listingId && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewListing(e);
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Listing
              </Button>
            )}
            {/* Pickup Confirmation Buttons - Show for both buyer and seller */}
            {safeOrder.isPickup && !safeOrder.pickupCompleted && 
             (safeOrder.status === 'paid' || safeOrder.status === 'awaiting_shipping') && (
              <>
                {/* Seller Pickup Confirmation */}
                {isSale && !safeOrder.sellerPickupConfirmed && (
                  <Button 
                    variant="default" 
                    className="bg-green-600 hover:bg-green-700 text-white font-medium w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompletePickup(e);
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Pickup (Seller)
                  </Button>
                )}
                
                {/* Buyer Pickup Confirmation */}
                {!isSale && !safeOrder.buyerPickupConfirmed && (
                  <Button 
                    variant="default" 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyerConfirmPickup(e);
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Pickup (Buyer)
                  </Button>
                )}
                
                {/* Show confirmation status */}
                {(safeOrder.buyerPickupConfirmed || safeOrder.sellerPickupConfirmed) && (
                  <div className="text-sm text-muted-foreground w-full text-center">
                    {safeOrder.buyerPickupConfirmed && safeOrder.sellerPickupConfirmed 
                      ? "Both parties confirmed pickup"
                      : safeOrder.buyerPickupConfirmed 
                        ? "Buyer confirmed • Waiting for seller"
                        : "Seller confirmed • Waiting for buyer"
                    }
                  </div>
                )}
              </>
            )}
            {/* Shipping Details Button - Only visible for buyers with orders requiring shipping details */}
            {!isSale && safeOrder.status === 'awaiting_shipping' && !safeOrder.shippingAddress && (
              <Button 
                variant="default" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/orders/${safeOrder.id}?shipping=true`);
                }}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Provide Shipping Details
              </Button>
            )}
            
            {/* Payment Button - Only visible for buyers with pending orders that are NOT pickup orders */}
            {!isSale && safeOrder.status === 'pending' && safeOrder.shippingAddress && !safeOrder.isPickup && (
              <AcceptedOfferCheckout
                orderId={safeOrder.id}
                sellerId={safeOrder.sellerId}
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white font-medium w-full"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Complete Payment
              </AcceptedOfferCheckout>
            )}
            
            {/* Leave Review Button - Only visible for buyers with completed orders that don't have a review yet */}
            {!isSale && safeOrder.status === 'completed' && !safeOrder.reviewSubmitted && (
              <Button 
                variant="default" 
                className="bg-primary hover:bg-primary/90 text-white font-medium w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/orders/${safeOrder.id}?review=true`);
                }}
              >
                <Star className="mr-2 h-4 w-4" />
                Leave Review
              </Button>
            )}

            {/* Request Refund Button - Only visible for buyers with eligible orders */}
            {isRefundEligible() && (
              <Button 
                variant="outline" 
                className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefundRequest(e);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Request Refund
              </Button>
            )}

            {/* Manage Refund Button - Only visible for sellers with refund requests */}
            {isSale && safeOrder.refundStatus === 'requested' && (
              <Button 
                variant="outline" 
                className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefundManagement(e);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Manage Refund
              </Button>
            )}

            {/* Relist Item Button - Only visible for sellers with completed refunds */}
            {isSale && safeOrder.refundStatus === 'completed' && (
              <Button 
                variant="outline" 
                className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRelistItem(e);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Relist Item
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      
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
                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
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
              onClick={completePickup}
              disabled={isCompletingPickup}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompletingPickup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Pickup
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
              onClick={confirmBuyerPickup}
              disabled={isConfirmingBuyerPickup}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConfirmingBuyerPickup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Pickup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund Request Dialog */}
      <RefundRequestDialog
        open={showRefundDialog}
        onOpenChange={setShowRefundDialog}
        order={safeOrder}
        onRefundRequested={handleRefundRequested}
      />

      {/* Refund Management Dialog */}
      <RefundManagementDialog
        open={showRefundManagementDialog}
        onOpenChange={setShowRefundManagementDialog}
        order={safeOrder}
        onRefundProcessed={handleRefundProcessed}
      />
    </Card>
  );
}