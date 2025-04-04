import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/router';

interface MarkAsSoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  listingId: string;
  listingTitle: string;
  hasStripeAccount: boolean;
  onConfirm: (createOrder: boolean) => Promise<boolean>;
  onManualMarkAsSold?: () => Promise<void>;
}

export function MarkAsSoldDialog({
  open,
  onOpenChange,
  offerId,
  listingId,
  listingTitle,
  hasStripeAccount,
  onConfirm,
  onManualMarkAsSold
}: MarkAsSoldDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualOption, setShowManualOption] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const success = await onConfirm(true);
      if (success) {
        toast({
          title: "Listing marked as sold",
          description: "The listing has been marked as sold and an order has been created.",
        });
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark listing as sold",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!hasStripeAccount) {
      setShowManualOption(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleManualMarkAsSold = async () => {
    setIsProcessing(true);
    try {
      if (onManualMarkAsSold) {
        await onManualMarkAsSold();
        toast({
          title: "Listing marked as sold",
          description: "The listing has been manually marked as sold.",
        });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark listing as sold",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {showManualOption ? "Mark Listing as Sold Manually?" : "Mark Listing as Sold?"}
          </DialogTitle>
          <DialogDescription>
            {showManualOption 
              ? "You can still mark this listing as sold manually without creating an order."
              : `Would you like to mark "${listingTitle}" as sold and remove it from your active listings?`}
          </DialogDescription>
        </DialogHeader>

        {!showManualOption && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Confirming will:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Mark the listing as sold</li>
              <li>Remove it from active listings</li>
              <li>Create an order for this sale</li>
              {hasStripeAccount && (
                <li>Allow the buyer to complete payment via Stripe</li>
              )}
            </ul>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {showManualOption ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleManualMarkAsSold}
                disabled={isProcessing}
              >
                Mark as Sold Manually
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleDecline}
                disabled={isProcessing}
              >
                No, Keep Active
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
              >
                Yes, Mark as Sold
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}