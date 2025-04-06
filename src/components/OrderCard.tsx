import { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/price';
import { format } from 'date-fns';
import Image from 'next/image';
import { UserNameLink } from '@/components/UserNameLink';
import { Package, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
    if (order.listingId) {
      router.push(`/listings/${order.listingId}`);
    }
  };
  
  // Function to handle the complete pickup button click
  const handleCompletePickup = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setShowCompletePickupDialog(true);
  };
  
  // Function to actually complete the pickup
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
  
  // Safety check for order
  if (!order || !order.id) {
    console.warn('OrderCard received invalid order data:', order);
    return null;
  }
  
  // Determine if this is an awaiting payment order
  const isAwaitingPayment = order.paymentStatus === 'awaiting_payment';
  
  // Ensure we have valid data for the order
  const safeOrder = {
    ...order,
    listingSnapshot: {
      title: order.listingSnapshot?.title || 'Unknown Listing',
      price: order.listingSnapshot?.price || 0,
      imageUrl: order.listingSnapshot?.imageUrl || '',
    },
    createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(),
    // Default to pending if status is missing
    status: isAwaitingPayment ? 'pending' : (order.status || 'pending')
  };

  return (
    <Card className="mb-4 cursor-pointer hover:shadow-md transition-shadow duration-200" onClick={handleViewOrder}>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
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
          <div className="flex-1">
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
                      'secondary'
                    }
                  >
                    {safeOrder.status === 'awaiting_shipping' 
                      ? 'Awaiting Shipping' 
                      : safeOrder.status.charAt(0).toUpperCase() + safeOrder.status.slice(1).replace('_', ' ')}
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
          
          <div className="flex flex-col gap-2 mt-2 md:mt-0">
            <Button 
              variant="outline" 
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewListing(e);
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Listing
              </Button>
            )}
            {/* Complete Pickup Button - Only visible for sellers with pickup orders that aren't completed */}
            {isSale && safeOrder.isPickup && !safeOrder.pickupCompleted && 
             (safeOrder.status === 'paid' || safeOrder.status === 'awaiting_shipping') && (
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700 text-white font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompletePickup(e);
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Pickup
              </Button>
            )}
            {/* Leave Review Button - Only visible for buyers with completed orders that don't have a review yet */}
            {!isSale && safeOrder.status === 'completed' && !safeOrder.reviewSubmitted && (
              <Button 
                variant="default" 
                className="bg-primary hover:bg-primary/90 text-white font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/orders/${safeOrder.id}?review=true`);
                }}
              >
                <Star className="mr-2 h-4 w-4" />
                Leave Review
              </Button>
            )}
          </div>
          
          {safeOrder.isPickup ? (
            <div className="md:w-1/3 hidden md:block">
              <h4 className="font-semibold mb-2">Delivery Method</h4>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-green-600 dark:text-green-400">Local Pickup</p>
                <p>Arrange pickup details with {isSale ? 'buyer' : 'seller'}</p>
              </div>
            </div>
          ) : safeOrder.shippingAddress && (
            <div className="md:w-1/3 hidden md:block">
              <h4 className="font-semibold mb-2">Shipping Address</h4>
              <div className="text-sm text-muted-foreground">
                <p>{safeOrder.shippingAddress.name}</p>
                <p>{safeOrder.shippingAddress.line1}</p>
                {safeOrder.shippingAddress.line2 && <p>{safeOrder.shippingAddress.line2}</p>}
                <p>
                  {safeOrder.shippingAddress.city}, {safeOrder.shippingAddress.state}{' '}
                  {safeOrder.shippingAddress.postal_code}
                </p>
              </div>
            </div>
          )}
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
    </Card>
  );
}