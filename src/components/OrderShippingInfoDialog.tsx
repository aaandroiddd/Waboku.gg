import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StateSelect } from '@/components/StateSelect';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface OrderShippingInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onComplete: (shippingAddress: any) => void;
}

export function OrderShippingInfoDialog({
  open,
  onOpenChange,
  orderId,
  onComplete
}: OrderShippingInfoDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Shipping address state
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');

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

      toast.success('Shipping information provided successfully', {
        description: 'The seller has been notified and will process your order'
      });
      
      onComplete(shippingAddress);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Provide Shipping Information</DialogTitle>
          <DialogDescription>
            Please provide your shipping address so the seller can ship your order.
          </DialogDescription>
        </DialogHeader>
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
                  <Label htmlFor="city">City</Label>
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
                  <Label htmlFor="state">State</Label>
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
                  <Label htmlFor="postalCode">ZIP Code</Label>
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
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
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