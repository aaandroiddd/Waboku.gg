import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, MapPin, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StateSelect } from '@/components/StateSelect';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

interface PostCheckoutShippingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onComplete: () => void;
}

export function PostCheckoutShippingDialog({
  open,
  onOpenChange,
  orderId,
  onComplete
}: PostCheckoutShippingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
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

  // Fetch order details to get any existing shipping info
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      
      try {
        setIsLoadingOrderDetails(true);
        const { db } = getFirebaseServices();
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        
        if (orderDoc.exists()) {
          const orderData = orderDoc.data();
          setOrderDetails(orderData);
          
          // Pre-populate form if shipping address exists (shouldn't happen but just in case)
          if (orderData.shippingAddress) {
            setName(orderData.shippingAddress.name || '');
            setLine1(orderData.shippingAddress.line1 || '');
            setLine2(orderData.shippingAddress.line2 || '');
            setCity(orderData.shippingAddress.city || '');
            setState(orderData.shippingAddress.state || '');
            setPostalCode(orderData.shippingAddress.postal_code || '');
            setCountry(orderData.shippingAddress.country || 'US');
          }
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
      
      await updateDoc(orderRef, {
        shippingAddress,
        updatedAt: new Date()
      });

      toast.success('Shipping information provided successfully');
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error providing shipping information:', error);
      const errorMessage = error.message || 'Failed to provide shipping information. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingOrderDetails) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Shipping Address Required
          </DialogTitle>
          <DialogDescription>
            Your payment was successful! Please provide your shipping address so the seller can ship your order.
          </DialogDescription>
        </DialogHeader>
        
        <Alert className="mt-2 bg-blue-500/10 border-blue-500/50">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="ml-2">
            This information is required to complete your order and will be shared with the seller for shipping purposes.
          </AlertDescription>
        </Alert>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={isSubmitting}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="line1">Address Line 1 *</Label>
                <Input
                  id="line1"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="123 Main St"
                  required
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
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="state">State *</Label>
                  <StateSelect
                    value={state}
                    onValueChange={setState}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">ZIP Code *</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="10001"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="country">Country *</Label>
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
            
            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">{error}</AlertDescription>
              </Alert>
            )}
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Save Shipping Address
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}