import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface CancelOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  listingTitle: string;
  onCancelled: () => void;
}

export function CancelOfferDialog({
  open,
  onOpenChange,
  offerId,
  listingTitle,
  onCancelled
}: CancelOfferDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleCancel = async () => {
    if (!user) {
      toast.error('You must be signed in to cancel an offer');
      return;
    }

    setIsSubmitting(true);

    try {
      const { db } = getFirebaseServices();
      const offerRef = doc(db, 'offers', offerId);
      
      await updateDoc(offerRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });

      toast.success('Offer cancelled successfully', {
        description: 'The offer has been removed from your dashboard'
      });
      
      onCancelled();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error cancelling offer:', error);
      toast.error('Failed to cancel offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancel Offer</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your offer for "{listingTitle}"?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep Offer
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}