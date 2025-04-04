import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { toast as sonnerToast } from 'sonner';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    
    // Show a loading toast that we can update later
    const loadingToastId = sonnerToast.loading('Processing your request...', {
      description: 'Creating order and marking listing as sold'
    });
    
    try {
      console.log('Confirming mark as sold for offer:', offerId);
      const success = await onConfirm(true);
      
      if (success) {
        // Update the loading toast to success
        sonnerToast.success('Listing marked as sold', {
          id: loadingToastId,
          description: "The listing has been marked as sold and an order has been created."
        });
        
        onOpenChange(false);
        
        // Redirect to orders page after a short delay
        setTimeout(() => {
          router.push('/dashboard/orders');
        }, 1500);
      } else {
        // If not successful but no error was thrown
        sonnerToast.error('Failed to mark listing as sold', {
          id: loadingToastId,
          description: "Please try again or contact support if the issue persists."
        });
        setErrorMessage('The operation could not be completed. Please try again.');
      }
    } catch (error: any) {
      console.error('Error in handleConfirm:', error);
      
      // Update the loading toast to error
      sonnerToast.error('Error', {
        id: loadingToastId,
        description: error.message || "Failed to mark listing as sold"
      });
      
      // Set error message for display in the dialog
      setErrorMessage(error.message || "Failed to mark listing as sold. Please try again or use the manual option.");
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
    if (!onManualMarkAsSold) return;
    
    setIsProcessing(true);
    setErrorMessage(null);
    
    // Show a loading toast
    const loadingToastId = sonnerToast.loading('Processing your request...', {
      description: 'Manually marking listing as sold'
    });
    
    try {
      console.log('Manually marking listing as sold:', listingId);
      await onManualMarkAsSold();
      
      // Update the loading toast to success
      sonnerToast.success('Listing marked as sold', {
        id: loadingToastId,
        description: "The listing has been manually marked as sold."
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error in handleManualMarkAsSold:', error);
      
      // Update the loading toast to error
      sonnerToast.error('Error', {
        id: loadingToastId,
        description: error.message || "Failed to mark listing as sold"
      });
      
      // Set error message for display in the dialog
      setErrorMessage(error.message || "Failed to mark listing as sold");
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
        
        {errorMessage && (
          <div className="py-2 px-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-medium">Error: {errorMessage}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {showManualOption 
                ? "You can try again or contact support if the issue persists."
                : "You can try again, use the manual option, or contact support if the issue persists."}
            </p>
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