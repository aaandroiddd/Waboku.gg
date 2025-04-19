import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, CreditCard, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StateSelect } from '@/components/StateSelect';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useStripeSellerStatus } from '@/hooks/useStripeSellerStatus';
import { loadStripe } from '@stripe/stripe-js';

interface OrderShippingInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onComplete: (shippingAddress: any) => void;
}

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export function OrderShippingInfoDialog({
  open,
  onOpenChange,
  orderId,
  onComplete
}: OrderShippingInfoDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const { hasStripeAccount, isLoading: isLoadingStripeStatus } = useStripeSellerStatus(sellerId || '');
  const [isCreatingPaymentSession, setIsCreatingPaymentSession] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(true);
  
  // Shipping address state
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');

  // Fetch order details to get seller ID
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      
      try {
        setIsLoadingOrderDetails(true);
        const { db } = getFirebaseServices();
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        
        if (orderDoc.exists()) {
          const orderData = orderDoc.data();
          setSellerId(orderData.sellerId);
          setOrderDetails(orderData);
        } else {
          console.error('Order not found');
          setError('Order not found');
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Failed to load order details');
      } finally {
        setIsLoadingOrderDetails(false);
      }
    };

    if (open) {
      fetchOrderDetails();
    }
  }, [orderId, open]);

  // Reset error when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
    }
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!user) {
      toast.error('Please sign in to provide shipping information');
      return;
    }

    // Validate shipping information
    if (!name || !line1 || !city || !state || !postalCode) {
      setError('Please complete all required shipping information');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare shipping address
      const shippingAddress = {
        name,
        line1,
        line2: line2 || undefined,
        city,
        state,
        postal_code: postalCode,
        country
      };
      
      // Update the order with shipping information
      const { db } = getFirebaseServices();
      const orderRef = doc(db, 'orders', orderId);
      
      // Get the current order to check if it's a new order or an update
      const orderDoc = await getDoc(orderRef);
      const orderData = orderDoc.exists() ? orderDoc.data() : null;
      const isUpdatingExistingShippingInfo = orderData && orderData.shippingAddress;
      
      await updateDoc(orderRef, {
        shippingAddress,
        updatedAt: new Date()
      });

      toast.success('Shipping information provided successfully');
      
      onComplete(shippingAddress);
      
      // Only proceed to payment if this is a new order (not updating shipping info)
      // and the seller has a Stripe account
      if (!isUpdatingExistingShippingInfo && hasStripeAccount && !isLoadingStripeStatus) {
        handleProceedToPayment(shippingAddress);
      } else {
        onOpenChange(false);
        toast.info('The seller will be notified about your shipping information', {
          description: 'They will contact you regarding payment details'
        });
      }
    } catch (error: any) {
      console.error('Error providing shipping information:', error);
      const errorMessage = error.message || 'Failed to provide shipping information. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleProceedToPayment = async (shippingAddress: any) => {
    if (!user || !orderDetails) return;
    
    try {
      setIsCreatingPaymentSession(true);
      
      // Get user email
      const { db } = getFirebaseServices();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const email = userDoc.exists() ? userDoc.data().email : user.email;
      
      if (!email) {
        throw new Error('User email not found');
      }
      
      // Create Stripe checkout session
      const response = await fetch('/api/stripe/connect/create-buy-now-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: orderDetails.listingId,
          userId: user.uid,
          email,
          orderId: orderId,
          offerPrice: orderDetails.offerPrice,
          shippingAddress
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment session');
      }
      
      // Redirect to Stripe Checkout
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
      
    } catch (error: any) {
      console.error('Error creating payment session:', error);
      const errorMessage = error.message || 'Failed to process payment. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      onOpenChange(false);
    } finally {
      setIsCreatingPaymentSession(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Provide Shipping Information</DialogTitle>
          <DialogDescription>
            Please provide your shipping address so the seller can ship your order.
          </DialogDescription>
        </DialogHeader>
        
        {hasStripeAccount && !isLoadingStripeStatus && (
          <Alert className="mt-2 bg-blue-500/10 border-blue-500/50">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription className="ml-2">
              After providing your shipping information, you'll be redirected to complete payment.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={isSubmitting || isCreatingPaymentSession}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="line1">Address Line 1</Label>
                <Input
                  id="line1"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="123 Main St"
                  required
                  disabled={isSubmitting || isCreatingPaymentSession}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                <Input
                  id="line2"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  placeholder="Apt 4B"
                  disabled={isSubmitting || isCreatingPaymentSession}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    required
                    disabled={isSubmitting || isCreatingPaymentSession}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="state">State</Label>
                  <StateSelect
                    value={state}
                    onValueChange={setState}
                    disabled={isSubmitting || isCreatingPaymentSession}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">ZIP Code</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="10001"
                    required
                    disabled={isSubmitting || isCreatingPaymentSession}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={country}
                    onValueChange={setCountry}
                    disabled={isSubmitting || isCreatingPaymentSession}
                  >
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
              disabled={isSubmitting || isCreatingPaymentSession}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isCreatingPaymentSession}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : isCreatingPaymentSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Payment...
                </>
              ) : hasStripeAccount && !isLoadingStripeStatus ? (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Continue to Payment
                </>
              ) : (
                'Submit Shipping Information'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}