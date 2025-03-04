import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/price';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

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

    setIsSubmitting(true);

    try {
      // Get the auth token
      const token = await user.getIdToken();
      
      console.log('Sending offer request with data:', {
        listingId,
        sellerId,
        amount,
        hasListingSnapshot: !!listingTitle && !!listingImageUrl
      });
      
      const response = await fetch('/api/offers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listingId,
          sellerId,
          amount,
          listingSnapshot: {
            title: listingTitle || 'Unknown Listing',
            price: listingPrice || 0,
            imageUrl: listingImageUrl || ''
          }
        }),
      });

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

      toast.success('Your offer has been sent!');
      onOpenChange(false);
      
      // Redirect to orders dashboard
      router.push('/dashboard/orders');
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
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="pl-7"
                  required
                />
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Offer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}