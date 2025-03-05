import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOffers } from '@/hooks/useOffers';

interface ClearOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  listingTitle: string;
  onCleared: () => void;
}

export function ClearOfferDialog({
  open,
  onOpenChange,
  offerId,
  listingTitle,
  onCleared
}: ClearOfferDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { clearOffer } = useOffers();

  const handleClear = async () => {
    if (!user) {
      toast.error('You must be signed in to clear an offer');
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await clearOffer(offerId);
      
      if (success) {
        onCleared();
        onOpenChange(false);
      } else {
        throw new Error('Failed to clear offer');
      }
    } catch (error: any) {
      console.error('Error clearing offer:', error);
      toast.error('Failed to clear offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Clear Offer</DialogTitle>
          <DialogDescription>
            Are you sure you want to clear this offer for "{listingTitle}" from your dashboard?
          </DialogDescription>
        </DialogHeader>
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
            type="button" 
            onClick={handleClear}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Clearing...' : 'Clear Offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}