import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/price';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StateSelect } from '@/components/StateSelect';

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
  const [offerAmount, setOfferAmount] = useState<string>(listingPrice.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  
  // Shipping address state
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');

  // Reset error and form when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      // Reset offer amount to listing price when dialog closes
      setOfferAmount(listingPrice.toString());
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
    
    // Validate shipping information if shipping is selected
    if (deliveryMethod === 'shipping') {
      if (!name || !line1 || !city || !state || !postalCode) {
        setError('Please complete all required shipping information');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Get the auth token
      const token = await user.getIdToken();
      
      // Prepare shipping address if applicable
      let shippingAddress = null;
      if (deliveryMethod === 'shipping') {
        shippingAddress = {
          name,
          line1,
          line2: line2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country
        };
      }
      
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
        shippingAddress,
        isPickup: deliveryMethod === 'pickup'
      };
      
      console.log('Sending offer request with data:', {
        listingId,
        sellerId,
        amount,
        hasListingSnapshot: !!listingTitle && !!listingImageUrl
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
                  <TabsTrigger value="shipping">Shipping</TabsTrigger>
                  <TabsTrigger value="pickup">Local Pickup</TabsTrigger>
                </TabsList>
                <TabsContent value="shipping" className="mt-4">
                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        required={deliveryMethod === 'shipping'}
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="line1">Address Line 1</Label>
                      <Input
                        id="line1"
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                        placeholder="123 Main St"
                        required={deliveryMethod === 'shipping'}
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                      <Input
                        id="line2"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                        placeholder="Apt 4B"
                        disabled={isSubmitting}
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
                          required={deliveryMethod === 'shipping'}
                          disabled={isSubmitting}
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="state">State</Label>
                        <StateSelect
                          value={state}
                          onValueChange={setState}
                          disabled={isSubmitting}
                          required={deliveryMethod === 'shipping'}
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
                          required={deliveryMethod === 'shipping'}
                          disabled={isSubmitting}
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="country">Country</Label>
                        <Select
                          value={country}
                          onValueChange={setCountry}
                          disabled={isSubmitting}
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
                </TabsContent>
                <TabsContent value="pickup" className="mt-4">
                  <div className="space-y-3">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="ml-2">
                        You'll arrange pickup details with the seller if your offer is accepted.
                      </AlertDescription>
                    </Alert>
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Offer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}