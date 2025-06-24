import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/price';
import { format, isValid } from 'date-fns';
import { AlertTriangle, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface RefundManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onRefundProcessed: () => void;
}

export function RefundManagementDialog({
  open,
  onOpenChange,
  order,
  onRefundProcessed,
}: RefundManagementDialogProps) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [action, setAction] = useState<'approve' | 'deny' | null>(null);
  const [sellerNotes, setSellerNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [isPartialRefund, setIsPartialRefund] = useState(false);

  const maxRefundAmount = order.amount || 0;

  // Helper function to safely format dates
  const formatDate = (date: any, formatString: string, fallback: string = 'Unknown') => {
    if (!date) return fallback;
    
    let dateObj: Date;
    
    // Handle different date formats from Firestore
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date && typeof date === 'object' && date.toDate) {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (date && typeof date === 'object' && date.seconds) {
      // Firestore Timestamp object
      dateObj = new Date(date.seconds * 1000);
    } else {
      return fallback;
    }
    
    // Check if the date is valid
    if (!isValid(dateObj)) {
      return fallback;
    }
    
    try {
      return format(dateObj, formatString);
    } catch (error) {
      console.error('Error formatting date:', error);
      return fallback;
    }
  };

  const handleProcessRefund = async () => {
    if (!action) return;

    try {
      setIsProcessing(true);

      // Validate refund amount if approving
      if (action === 'approve' && isPartialRefund) {
        const amount = parseFloat(refundAmount);
        if (isNaN(amount) || amount <= 0 || amount > maxRefundAmount) {
          toast.error(`Refund amount must be between $0.01 and ${formatPrice(maxRefundAmount)}`);
          return;
        }
      }

      const token = await user?.getIdToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/orders/process-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          action,
          refundAmount: isPartialRefund ? parseFloat(refundAmount) : undefined,
          sellerNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process refund');
      }

      if (action === 'approve') {
        toast.success(
          `Refund ${isPartialRefund ? 'partially ' : ''}approved and processed successfully!`
        );
      } else {
        toast.success('Refund request denied');
      }

      onRefundProcessed();
      onOpenChange(false);
      
      // Reset form
      setAction(null);
      setSellerNotes('');
      setRefundAmount('');
      setIsPartialRefund(false);

    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process refund');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
      setAction(null);
      setSellerNotes('');
      setRefundAmount('');
      setIsPartialRefund(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${order.refundStatus === 'failed' ? 'text-red-500' : 'text-orange-500'}`} />
            {order.refundStatus === 'failed' ? 'Retry Failed Refund' : 'Refund Request Management'}
          </DialogTitle>
          <DialogDescription>
            {order.refundStatus === 'failed' 
              ? 'The previous refund attempt failed. You can retry the refund or deny the request.'
              : 'Review and process the refund request for this order.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Information */}
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Order Details</h4>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono text-sm">{order.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item:</span>
                  <span>{order.listingSnapshot?.title || 'Unknown Item'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Amount:</span>
                  <span className="font-semibold">{formatPrice(order.amount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Date:</span>
                  <span>{formatDate(order.createdAt, 'PPP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{order.status}</Badge>
                </div>
              </div>
            </div>

            {/* Refund Request Information */}
            <div>
              <h4 className="font-semibold mb-2">Refund Request</h4>
              <div className={`p-4 rounded-lg space-y-2 ${
                order.refundStatus === 'failed' 
                  ? 'bg-red-50 dark:bg-red-900/20' 
                  : 'bg-orange-50 dark:bg-orange-900/20'
              }`}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested:</span>
                  <span>{formatDate(order.refundRequestedAt, 'PPp')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={order.refundStatus === 'failed' ? 'destructive' : 'warning'}>
                    {order.refundStatus === 'failed' ? 'Failed - Retry Available' : 'Pending Review'}
                  </Badge>
                </div>
                {order.refundStatus === 'failed' && order.refundNotes && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Failure Reason:</span>
                    <p className="text-sm bg-background p-2 rounded border text-red-600 dark:text-red-400">
                      {order.refundNotes}
                    </p>
                  </div>
                )}
                {order.refundReason && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Buyer's Reason:</span>
                    <p className="text-sm bg-background p-2 rounded border">
                      {order.refundReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Selection */}
          {!action && (
            <div className="space-y-4">
              <h4 className="font-semibold">Choose Action</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-auto p-4 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAction('approve');
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <span className="font-semibold">Approve Refund</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Process the refund through Stripe
                    </span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAction('deny');
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <XCircle className="h-6 w-6 text-red-600" />
                    <span className="font-semibold">Deny Refund</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Reject the refund request
                    </span>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Approve Refund Form */}
          {action === 'approve' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-green-700 dark:text-green-400">
                  Approve Refund
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAction(null)}
                >
                  Change Action
                </Button>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  The refund will be processed through Stripe and typically takes 5-10 business days to appear in the customer's account.
                </AlertDescription>
              </Alert>

              {/* Refund Amount Options */}
              <div className="space-y-3">
                <Label>Refund Amount</Label>
                <div className="space-y-2">
                  <div 
                    className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-muted/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPartialRefund(false);
                    }}
                  >
                    <input
                      type="radio"
                      id="full-refund"
                      name="refund-type"
                      checked={!isPartialRefund}
                      onChange={() => setIsPartialRefund(false)}
                      className="h-4 w-4 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="full-refund" className="text-sm font-medium cursor-pointer">
                      Full Refund: {formatPrice(maxRefundAmount)}
                    </label>
                  </div>
                  <div 
                    className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-muted/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPartialRefund(true);
                    }}
                  >
                    <input
                      type="radio"
                      id="partial-refund"
                      name="refund-type"
                      checked={isPartialRefund}
                      onChange={() => setIsPartialRefund(true)}
                      className="h-4 w-4 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="partial-refund" className="text-sm font-medium cursor-pointer">
                      Partial Refund
                    </label>
                  </div>
                </div>

                {isPartialRefund && (
                  <div className="ml-6">
                    <Label htmlFor="refund-amount">Refund Amount</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="refund-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={maxRefundAmount}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        (Max: {formatPrice(maxRefundAmount)})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="seller-notes">Notes (Optional)</Label>
                <Textarea
                  id="seller-notes"
                  value={sellerNotes}
                  onChange={(e) => setSellerNotes(e.target.value)}
                  placeholder="Add any notes about this refund approval..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Deny Refund Form */}
          {action === 'deny' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-red-700 dark:text-red-400">
                  Deny Refund Request
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAction(null)}
                >
                  Change Action
                </Button>
              </div>

              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  The buyer will be notified that their refund request has been denied. Please provide a clear reason.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="denial-reason">Reason for Denial *</Label>
                <Textarea
                  id="denial-reason"
                  value={sellerNotes}
                  onChange={(e) => setSellerNotes(e.target.value)}
                  placeholder="Please explain why the refund request is being denied..."
                  className="mt-1"
                  rows={4}
                  required
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          {action && (
            <Button
              onClick={handleProcessRefund}
              disabled={isProcessing || (action === 'deny' && !sellerNotes.trim())}
              className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isProcessing ? 'Processing...' : action === 'approve' ? 'Process Refund' : 'Deny Request'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}