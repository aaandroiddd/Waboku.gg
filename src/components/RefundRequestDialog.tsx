import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/order';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/price';
import { format, addDays } from 'date-fns';

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onRefundRequested: () => void;
}

const REFUND_REASONS = [
  { value: 'item_not_received', label: 'Item not received' },
  { value: 'item_damaged', label: 'Item arrived damaged' },
  { value: 'item_not_as_described', label: 'Item not as described' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'quality_issues', label: 'Quality issues' },
  { value: 'seller_issue', label: 'Issue with seller communication' },
  { value: 'other', label: 'Other (please specify)' }
];

export function RefundRequestDialog({ 
  open, 
  onOpenChange, 
  order, 
  onRefundRequested 
}: RefundRequestDialogProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if order is eligible for refund
  const checkEligibility = () => {
    // Check if order has been paid
    if (!order.paymentIntentId && !order.paymentSessionId) {
      return { eligible: false, reason: 'Order has not been paid' };
    }

    // Check if order is already refunded
    if (order.status === 'refunded' || order.status === 'partially_refunded') {
      return { eligible: false, reason: 'Order has already been refunded' };
    }

    // Check if order is cancelled
    if (order.status === 'cancelled') {
      return { eligible: false, reason: 'Cancelled orders cannot be refunded' };
    }

    // Check if this is a pickup order that has been completed
    if (order.isPickup && order.pickupCompleted) {
      return { eligible: false, reason: 'Pickup orders cannot be refunded after completion' };
    }

    // Check if refund already requested
    if (order.refundStatus && order.refundStatus !== 'none') {
      return { eligible: false, reason: `Refund already ${order.refundStatus}` };
    }

    // Check refund deadline (30 days from order creation)
    const orderCreatedAt = order.createdAt;
    const refundDeadline = addDays(orderCreatedAt, 30);
    
    if (new Date() > refundDeadline) {
      return { 
        eligible: false, 
        reason: `Refund deadline has passed (30 days from order date: ${format(refundDeadline, 'PPP')})` 
      };
    }

    return { eligible: true };
  };

  const eligibility = checkEligibility();
  const refundDeadline = addDays(order.createdAt, 30);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason for the refund');
      return;
    }

    if (selectedReason === 'other' && !customReason.trim()) {
      toast.error('Please provide details for your refund request');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to request a refund');
      return;
    }

    setIsSubmitting(true);

    try {
      const reason = selectedReason === 'other' 
        ? customReason.trim()
        : REFUND_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

      const response = await fetch('/api/orders/request-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          reason: reason,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to submit refund request');
      }

      toast.success('Refund request submitted successfully');
      onRefundRequested();
      onOpenChange(false);
      
      // Reset form
      setSelectedReason('');
      setCustomReason('');

    } catch (error) {
      console.error('Error submitting refund request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit refund request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedReason('');
    setCustomReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Request Refund</DialogTitle>
          <DialogDescription>
            Request a refund for your order: {order.listingSnapshot?.title || `Order #${order.id.slice(0, 8)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Order Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Order Amount:</span>
              <span className="font-medium">{formatPrice(order.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Order Date:</span>
              <span className="text-sm">{format(order.createdAt, 'PPP')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Refund Deadline:</span>
              <span className="text-sm">{format(refundDeadline, 'PPP')}</span>
            </div>
          </div>

          {/* Eligibility Check */}
          {!eligibility.eligible ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>This order is not eligible for refund:</strong> {eligibility.reason}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Refund Policy:</strong> You have 30 days from the order date to request a refund. 
                  Refunds are processed back to your original payment method and may take 5-10 business days to appear.
                </AlertDescription>
              </Alert>

              {/* Reason Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Reason for refund request</Label>
                <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                  {REFUND_REASONS.map((reason) => (
                    <div key={reason.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={reason.value} id={reason.value} />
                      <Label htmlFor={reason.value} className="cursor-pointer">
                        {reason.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Custom Reason Input */}
              {selectedReason === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="customReason">Please provide details</Label>
                  <Textarea
                    id="customReason"
                    placeholder="Describe the issue with your order..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {customReason.length}/500 characters
                  </div>
                </div>
              )}

              {/* Additional Information */}
              {selectedReason && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>What happens next?</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Your refund request will be reviewed by the seller</li>
                      <li>You'll receive email and in-app notifications about the status</li>
                      <li>If approved, the refund will be processed automatically</li>
                      <li>Refunds typically take 5-10 business days to appear in your account</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          {eligibility.eligible && (
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedReason || isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Submit Refund Request
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}