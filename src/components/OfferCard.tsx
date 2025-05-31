import { Offer } from '@/types/offer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/price';
import { format, formatDistanceToNow, differenceInHours, isPast } from 'date-fns';
import Image from 'next/image';
import { UserNameLink } from '@/components/UserNameLink';
import { Check, X, RefreshCw, Send, Trash2, XCircle, MapPin, Truck, Clock, AlertTriangle } from 'lucide-react';
import { useOffers } from '@/hooks/useOffers';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CancelOfferDialog } from '@/components/CancelOfferDialog';
import { ClearOfferDialog } from '@/components/ClearOfferDialog';
import { MarkAsSoldDialog } from '@/components/MarkAsSoldDialog';
import { ShippingInfoDialog } from '@/components/ShippingInfoDialog';
import { toast } from 'sonner';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface OfferCardProps {
  offer: Offer;
  type: 'received' | 'sent';
  onCounterOffer?: () => void;
}

export function OfferCard({ offer, type, onCounterOffer }: OfferCardProps) {
  const { updateOfferStatus, cancelOffer, clearOffer, createOrderFromOffer, markListingAsSold } = useOffers();
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [markAsSoldDialogOpen, setMarkAsSoldDialogOpen] = useState(false);
  const [shippingInfoDialogOpen, setShippingInfoDialogOpen] = useState(false);
  const [hasStripeAccount, setHasStripeAccount] = useState(false);

  // Check if the seller has a Stripe account when the component mounts
  useEffect(() => {
    const checkStripeAccount = async () => {
      if (type === 'received' && offer.sellerId) {
        try {
          const { db } = getFirebaseServices();
          if (!db) {
            console.error('Firebase DB not initialized');
            return;
          }
          
          const userDocRef = doc(db, 'users', offer.sellerId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const hasActiveStripeAccount = 
              !!userData.stripeConnectAccountId && 
              userData.stripeConnectStatus === 'active';
            
            setHasStripeAccount(hasActiveStripeAccount);
          }
        } catch (error) {
          console.error('Error checking Stripe account:', error);
          // Don't update state on error, keep default false
        }
      }
    };

    checkStripeAccount();
    
    // Check if we need to show the shipping info dialog for newly accepted offers
    if (type === 'sent' && 
        offer.status === 'accepted' && 
        offer.requiresShippingInfo && 
        !offer.shippingInfoProvided) {
      // Show shipping info dialog for accepted offers that need shipping info
      setShippingInfoDialogOpen(true);
    }
  }, [offer.sellerId, type, offer.status, offer.requiresShippingInfo, offer.shippingInfoProvided]);

  const handleAccept = async () => {
    setIsUpdating(true);
    const success = await updateOfferStatus(offer.id, 'accepted');
    setIsUpdating(false);
    
    // If this is a received offer and it was successfully accepted, show the mark as sold dialog
    if (success && type === 'received') {
      setMarkAsSoldDialogOpen(true);
    }
  };

  const handleDecline = async () => {
    setIsUpdating(true);
    await updateOfferStatus(offer.id, 'declined');
    setIsUpdating(false);
  };

  const handleViewListing = () => {
    router.push(`/listings/${offer.listingId}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'accepted':
        return 'default';
      case 'declined':
      case 'expired':
        return 'destructive';
      case 'countered':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Ensure we have valid data for the offer
  const safeOffer = {
    ...offer,
    listingSnapshot: {
      title: offer.listingSnapshot?.title || 'Unknown Listing',
      price: offer.listingSnapshot?.price || 0,
      imageUrl: offer.listingSnapshot?.imageUrl || '',
    },
    createdAt: offer.createdAt instanceof Date ? offer.createdAt : new Date(),
    expiresAt: offer.expiresAt instanceof Date ? offer.expiresAt : null,
    status: offer.status || 'pending'
  };

  // Calculate expiration status
  const getExpirationInfo = () => {
    if (!safeOffer.expiresAt || safeOffer.status !== 'pending') {
      return null;
    }

    const now = new Date();
    const isExpired = isPast(safeOffer.expiresAt);
    const hoursUntilExpiry = differenceInHours(safeOffer.expiresAt, now);
    const isExpiringSoon = hoursUntilExpiry <= 24 && hoursUntilExpiry > 0;

    return {
      isExpired,
      isExpiringSoon,
      hoursUntilExpiry,
      timeUntilExpiry: formatDistanceToNow(safeOffer.expiresAt, { addSuffix: true })
    };
  };

  const expirationInfo = getExpirationInfo();

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32 cursor-pointer" onClick={handleViewListing}>
            {safeOffer.listingSnapshot.imageUrl ? (
              <Image
                src={safeOffer.listingSnapshot.imageUrl}
                alt={safeOffer.listingSnapshot.title}
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
            <h3 className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary" onClick={handleViewListing}>
              {safeOffer.listingSnapshot.title}
            </h3>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {type === 'received' ? 'From: ' : 'To: '}
                <UserNameLink userId={type === 'received' ? safeOffer.buyerId : safeOffer.sellerId} />
              </p>
              <p className="text-muted-foreground">
                Date: {format(safeOffer.createdAt, 'PPP')}
              </p>
              {safeOffer.expiresAt && (
                <p className="text-muted-foreground">
                  <Clock className="inline mr-1 h-3 w-3" />
                  Expires: {format(safeOffer.expiresAt, 'PPP')}
                  {expirationInfo && (
                    <span className={`ml-2 text-xs ${
                      expirationInfo.isExpiringSoon ? 'text-orange-500' : 'text-muted-foreground'
                    }`}>
                      ({expirationInfo.timeUntilExpiry})
                    </span>
                  )}
                </p>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div>
                  <span className="text-muted-foreground">Listing Price: </span>
                  <span className="dark:text-amber-400 text-amber-600">{formatPrice(safeOffer.listingSnapshot.price)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Offer: </span>
                  <span className="font-semibold dark:text-yellow-300 text-yellow-600">{formatPrice(safeOffer.amount)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge
                  variant={getStatusBadgeVariant(safeOffer.status)}
                >
                  {safeOffer.status.charAt(0).toUpperCase() + safeOffer.status.slice(1)}
                </Badge>
                
                {/* Show expiration warning badge */}
                {expirationInfo?.isExpiringSoon && (
                  <Badge variant="outline" className="border-orange-500 text-orange-500">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Expires Soon
                  </Badge>
                )}
                
                {/* Show shipping info needed badge */}
                {type === 'sent' && 
                 safeOffer.status === 'accepted' && 
                 safeOffer.requiresShippingInfo && 
                 !safeOffer.shippingInfoProvided && (
                  <Badge variant="outline" className="border-blue-500 text-blue-500">
                    <Truck className="mr-1 h-3 w-3" />
                    Shipping Info Needed
                  </Badge>
                )}
                
                {/* Show pickup badge */}
                {safeOffer.isPickup && (
                  <Badge variant="outline" className="border-amber-500 text-amber-500">
                    <MapPin className="mr-1 h-3 w-3" />
                    Local Pickup
                  </Badge>
                )}
              </div>
              
              {safeOffer.counterOffer && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <p className="text-sm font-medium">Counter Offer: {formatPrice(safeOffer.counterOffer)}</p>
                </div>
              )}
            </div>
          </div>
          
          {type === 'received' && offer.status === 'pending' && (
            <div className="flex flex-row md:flex-col gap-2 mt-2 md:mt-0">
              <Button 
                variant="default" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={isUpdating}
              >
                <Check className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={handleDecline}
                disabled={isUpdating}
              >
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={onCounterOffer}
                disabled={isUpdating}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Counter
              </Button>
            </div>
          )}
          
          {type === 'sent' && offer.status === 'pending' && (
            <div className="flex flex-col gap-2 mt-2 md:mt-0">
              <Button 
                variant="outline" 
                onClick={handleViewListing}
              >
                View Listing
              </Button>
              <Button 
                variant="outline" 
                className="border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={() => setCancelDialogOpen(true)}
                disabled={isUpdating}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Offer
              </Button>
            </div>
          )}
          
          {type === 'sent' && offer.status === 'countered' && (
            <div className="flex flex-col gap-2 mt-2 md:mt-0">
              <Button 
                variant="default" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={isUpdating}
              >
                <Check className="mr-2 h-4 w-4" />
                Accept Counter
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={handleDecline}
                disabled={isUpdating}
              >
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button 
                variant="outline" 
                onClick={handleViewListing}
              >
                View Listing
              </Button>
            </div>
          )}
          
          {(offer.status === 'accepted' || offer.status === 'declined' || offer.status === 'expired' || offer.status === 'cancelled') && (
            <div className="flex flex-col gap-2 mt-2 md:mt-0">
              <Button 
                variant="outline" 
                onClick={handleViewListing}
              >
                View Listing
              </Button>
              
              {/* For sent offers that are accepted and require shipping info */}
              {type === 'sent' && 
               offer.status === 'accepted' && 
               offer.requiresShippingInfo && 
               !offer.shippingInfoProvided && (
                <Button 
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShippingInfoDialogOpen(true)}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Provide Shipping Info
                </Button>
              )}
              
              {/* For sent offers that are accepted with pickup */}
              {type === 'sent' && 
               offer.status === 'accepted' && 
               offer.isPickup && (
                <Button 
                  variant="outline"
                  className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Arrange Pickup
                </Button>
              )}
              
              {type === 'sent' && offer.status === 'declined' && (
                <Button 
                  variant="outline"
                  onClick={() => router.push(`/listings/${offer.listingId}?makeOffer=true`)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Make New Offer
                </Button>
              )}
              {type === 'sent' && (
                <Button 
                  variant="outline"
                  onClick={() => setClearDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Offer
                </Button>
              )}
              {type === 'received' && offer.status === 'accepted' && (
                <Button 
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setMarkAsSoldDialogOpen(true)}
                  disabled={isUpdating}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Move to Sales
                </Button>
              )}
              {type === 'received' && (offer.status === 'declined' || offer.status === 'expired' || offer.status === 'cancelled') && (
                <Button 
                  variant="outline"
                  onClick={() => setClearDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Offer
                </Button>
              )}
            </div>
          )}
          
          {/* Cancel Offer Dialog */}
          <CancelOfferDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
            offerId={offer.id}
            listingTitle={safeOffer.listingSnapshot.title}
            onCancelled={() => {
              // This is now handled by the custom event
            }}
          />
          
          {/* Clear Offer Dialog */}
          <ClearOfferDialog
            open={clearDialogOpen}
            onOpenChange={setClearDialogOpen}
            offerId={offer.id}
            listingTitle={safeOffer.listingSnapshot.title}
            onCleared={() => {
              // This is now handled by the custom event in the dialog component
            }}
          />
          
          {/* Mark as Sold Dialog */}
          {type === 'received' && (
            <MarkAsSoldDialog
              open={markAsSoldDialogOpen}
              onOpenChange={setMarkAsSoldDialogOpen}
              offerId={offer.id}
              listingId={offer.listingId}
              listingTitle={safeOffer.listingSnapshot.title}
              hasStripeAccount={hasStripeAccount}
              onConfirm={async (createOrder) => {
                setIsUpdating(true);
                try {
                  // If createOrder is true, create an order and mark as sold
                  if (createOrder) {
                    const success = await createOrderFromOffer(offer.id, true);
                    return success;
                  }
                  return false;
                } finally {
                  setIsUpdating(false);
                }
              }}
              onManualMarkAsSold={async () => {
                setIsUpdating(true);
                try {
                  console.log('Manually marking listing as sold from OfferCard:', offer.listingId);
                  
                  // First try to mark the listing as sold
                  const success = await markListingAsSold(offer.listingId, offer.buyerId);
                  
                  if (success) {
                    // If successful, also clear the offer to remove it from the dashboard
                    await clearOffer(offer.id);
                    
                    // Note: We don't need to manually update local state here
                    // as the clearOffer function already handles this
                    
                    toast.success('Listing marked as sold', {
                      description: 'The listing has been manually marked as sold and the offer has been cleared.'
                    });
                    
                    // Redirect to dashboard after a short delay
                    setTimeout(() => {
                      router.push('/dashboard');
                    }, 1500);
                  } else {
                    throw new Error('Failed to mark listing as sold');
                  }
                } catch (error: any) {
                  console.error('Error in manual mark as sold:', error);
                  toast.error('Failed to mark listing as sold', {
                    description: error.message || 'Please try again or contact support'
                  });
                  throw error; // Re-throw to be handled by the dialog
                } finally {
                  setIsUpdating(false);
                }
              }}
            />
          )}
          
          {/* Shipping Info Dialog */}
          {type === 'sent' && (
            <ShippingInfoDialog
              open={shippingInfoDialogOpen}
              onOpenChange={setShippingInfoDialogOpen}
              offerId={offer.id}
              listingTitle={safeOffer.listingSnapshot.title}
              onComplete={() => {
                toast.success('Shipping information provided', {
                  description: 'The seller has been notified and will process your order'
                });
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}