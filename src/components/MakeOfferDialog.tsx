import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/price';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

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
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the auth token
      const token = await user.getIdToken();
      
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
            title: listingTitle,
            price: listingPrice,
            imageUrl: listingImageUrl
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create offer');
      }

      toast.success('Your offer has been sent!');
      onOpenChange(false);
      
      // Redirect to offers dashboard
      router.push('/dashboard/offers');
    } catch (error: any) {
      console.error('Error creating offer:', error);
      toast.error(error.message || 'Failed to send offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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