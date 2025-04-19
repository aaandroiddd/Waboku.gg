import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/price';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, InfoIcon, CreditCard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StateSelect } from '@/components/StateSelect';
import { useStripeSellerStatus } from '@/hooks/useStripeSellerStatus';
import MakeOfferTutorial from './MakeOfferTutorial';

interface MakeOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  sellerId: string;
  listingTitle: string;
  listingPrice: number;
  listingImageUrl: string;
}

export function MakeOfferDialog({
  open,
  onOpenChange,
  listingId,
  sellerId,
  listingTitle,
  listingPrice,
  listingImageUrl
}: MakeOfferDialogProps) {
  // State to track if tutorial has been completed
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [offerAmount, setOfferAmount] = useState<string>(listingPrice.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const { hasStripeAccount, isLoading: isLoadingStripeStatus } = useStripeSellerStatus(sellerId);
  
  // Acknowledgment checkboxes
  const [shippingAcknowledged, setShippingAcknowledged] = useState(false);
  const [pickupAcknowledged, setPickupAcknowledged] = useState(false);
  const [paymentAcknowledged, setPaymentAcknowledged] = useState(false);

  // Reset error and form when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      // Reset offer amount to listing price when dialog closes
      setOfferAmount(listingPrice.toString());
      setShippingAcknowledged(false);
      setPickupAcknowledged(false);
      setPaymentAcknowledged(false);
    }
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!user) {
      toast.error('Please sign in to make an offer');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === sellerId) {
      toast.error('You cannot make an offer on your own listing');
      return;
    }

    const amount = parseFloat(offerAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    
    // Validate acknowledgment based on delivery method
    if (deliveryMethod === 'shipping' && !shippingAcknowledged) {
      setError('Please acknowledge that you will provide shipping information if your offer is accepted');
      return;
    }
    
    if (deliveryMethod === 'pickup' && !pickupAcknowledged) {
      setError('Please acknowledge that you will need to arrange pickup with the seller if your offer is accepted');
      return;
    }

    // Validate payment acknowledgment if seller has Stripe account
    if (hasStripeAccount && deliveryMethod === 'shipping' && !paymentAcknowledged) {
      setError('Please acknowledge that payment will be required if your offer is accepted');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the auth token
      const token = await user.getIdToken();
      
      // Prepare the request payload
      const payload = {
        listingId,
        sellerId,
        amount,
        listingSnapshot: {
          title: listingTitle || 'Unknown Listing',
          price: listingPrice || 0,
          imageUrl: listingImageUrl || ''
        },
        shippingAddress: null, // No shipping address at this stage
        isPickup: deliveryMethod === 'pickup',
        requiresShippingInfo: deliveryMethod === 'shipping',
        sellerHasStripeAccount: hasStripeAccount
      };
      
      console.log('Sending offer request with data:', {
        listingId,
        sellerId,
        amount,
        hasListingSnapshot: !!listingTitle && !!listingImageUrl,
        isPickup: deliveryMethod === 'pickup',
        sellerHasStripeAccount: hasStripeAccount
      });
      
      // Make the API request with retry logic
      let response;
      let retryCount = 0;
      const maxRetries = 3; // Increased from 2 to 3
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1} to send offer request...`);
          response = await fetch('/api/offers/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
          });
          
          // If we get a 500 error, retry
          if (response.status >= 500) {
            console.log(`Server error (${response.status}), will retry...`);
            retryCount++;
            if (retryCount > maxRetries) {
              console.error(`Max retries (${maxRetries}) reached with server error ${response.status}`);
              break; // Exit the loop but continue processing the response
            }
            // Wait before retrying (exponential backoff)
            const delay = 1000 * Math.pow(2, retryCount);
            console.log(`Waiting ${delay}ms before retry ${retryCount}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // For non-500 errors or success, break the loop
          break;
        } catch (fetchError) {
          console.error('Network error during fetch:', fetchError);
          retryCount++;
          if (retryCount > maxRetries) {
            throw new Error('Network error while creating offer. Please check your connection and try again.');
          }
          // Wait before retrying (exponential backoff)
          const delay = 1000 * Math.pow(2, retryCount);
          console.log(`Network error, waiting ${delay}ms before retry ${retryCount}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!response) {
        throw new Error('Failed to connect to the server. Please try again later.');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Server returned an invalid response. Please try again.');
      }
      
      if (!response.ok) {
        console.error('Error response from server:', data);
        
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Authentication error. Please sign in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to perform this action.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Our team has been notified. Please try again later.');
        }
        
        throw new Error(data.error || data.message || data.details || 'Failed to create offer');
      }

      toast.success('Your offer has been sent successfully!', {
        description: 'You can view your offer in your dashboard',
        duration: 5000
      });
      onOpenChange(false);
      
      // Redirect to offers dashboard
      router.push('/dashboard/offers?tab=sent');
    } catch (error: any) {
      console.error('Error creating offer:', error);
      const errorMessage = error.message || 'Failed to send offer. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <MakeOfferTutorial 
        isActive={open && !tutorialCompleted} 
        onComplete={() => setTutorialCompleted(true)} 
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Enter your offer amount for this listing. The seller will be notified and can accept or decline.
            </DialogDescription>
          </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="listing">Listing</Label>
              <div className="text-sm text-muted-foreground">{listingTitle}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="listingPrice">Listing Price</Label>
              <div className="text-sm font-medium">{formatPrice(listingPrice)}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offerAmount">Your Offer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="offerAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={offerAmount}
                  onChange={(e) => {
                    setOfferAmount(e.target.value);
                    // Clear error when user changes the input
                    if (error) setError(null);
                  }}
                  className="pl-7"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground">Enter the amount you want to offer for this item</p>
            </div>
            
            <div className="grid gap-2 mt-2">
              <Label>Delivery Method</Label>
              <Tabs 
                value={deliveryMethod} 
                onValueChange={(value) => setDeliveryMethod(value as 'shipping' | 'pickup')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="shipping" disabled={!hasStripeAccount && !isLoadingStripeStatus}>
                    Shipping
                  </TabsTrigger>
                  <TabsTrigger value="pickup">Local Pickup</TabsTrigger>
                </TabsList>
                
                {!hasStripeAccount && !isLoadingStripeStatus && deliveryMethod === 'shipping' && (
                  <div className="mt-2">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="ml-2">
                        This seller doesn't support shipping. You can only make a local pickup offer.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                
                <TabsContent value="shipping" className="mt-4">
                  <div className="space-y-3">
                    <Alert className="bg-blue-500/10 border-blue-500/50">
                      <InfoIcon className="h-4 w-4 text-blue-500" />
                      <AlertDescription className="ml-2">
                        If your offer is accepted, you will need to provide a shipping address.
                      </AlertDescription>
                    </Alert>
                    
                    {hasStripeAccount && (
                      <Alert className="bg-green-500/10 border-green-500/50">
                        <CreditCard className="h-4 w-4 text-green-500" />
                        <AlertDescription className="ml-2">
                          This seller accepts online payments. You'll be asked to pay after providing shipping information.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="flex items-start space-x-2 pt-2">
                      <Checkbox 
                        id="shipping-acknowledge" 
                        checked={shippingAcknowledged}
                        onCheckedChange={(checked) => setShippingAcknowledged(checked as boolean)}
                        disabled={isSubmitting}
                      />
                      <Label 
                        htmlFor="shipping-acknowledge" 
                        className="text-sm font-normal leading-tight cursor-pointer"
                      >
                        I understand that I will need to provide my shipping address after the seller accepts my offer.
                      </Label>
                    </div>
                    
                    {hasStripeAccount && (
                      <div className="flex items-start space-x-2 pt-2">
                        <Checkbox 
                          id="payment-acknowledge" 
                          checked={paymentAcknowledged}
                          onCheckedChange={(checked) => setPaymentAcknowledged(checked as boolean)}
                          disabled={isSubmitting}
                        />
                        <Label 
                          htmlFor="payment-acknowledge" 
                          className="text-sm font-normal leading-tight cursor-pointer"
                        >
                          I understand that I will need to make payment after providing shipping information if my offer is accepted.
                        </Label>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="pickup" className="mt-4">
                  <div className="space-y-3">
                    <Alert className="bg-amber-500/10 border-amber-500/50">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="ml-2">
                        You'll need to arrange pickup details with the seller if your offer is accepted.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex items-start space-x-2 pt-2">
                      <Checkbox 
                        id="pickup-acknowledge" 
                        checked={pickupAcknowledged}
                        onCheckedChange={(checked) => setPickupAcknowledged(checked as boolean)}
                        disabled={isSubmitting}
                      />
                      <Label 
                        htmlFor="pickup-acknowledge" 
                        className="text-sm font-normal leading-tight cursor-pointer"
                      >
                        I understand that I will need to arrange pickup with the seller after my offer is accepted.
                      </Label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (deliveryMethod === 'shipping' && !hasStripeAccount && !isLoadingStripeStatus)}
            >
              {isSubmitting ? 'Sending...' : 'Send Offer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}