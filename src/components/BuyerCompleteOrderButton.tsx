import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Order } from '@/types/order';

interface BuyerCompleteOrderButtonProps {
  order: Order;
  onOrderCompleted?: () => void;
}

export const BuyerCompleteOrderButton: React.FC<BuyerCompleteOrderButtonProps> = ({
  order,
  onOrderCompleted
}) => {
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  // Helpers to choose the most accurate "payment reference" time
  const normalizeDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d === 'object' && typeof (d as any).toDate === 'function') return (d as any).toDate();
    if (typeof d === 'object' && 'seconds' in d) return new Date((d as any).seconds * 1000);
    try {
      return new Date(d);
    } catch {
      return null;
    }
  };

  const getPaymentReferenceDate = (o: Order): Date | null => {
    // Prefer explicit scheduling field if present
    const eligibleAt = normalizeDate((o as any).autoCompletionEligibleAt);
    if (eligibleAt) return eligibleAt;
    // If order is paid, updatedAt often reflects post-payment update
    if (o.paymentStatus === 'paid') {
      const upd = normalizeDate(o.updatedAt);
      if (upd) return upd;
    }
    // Fallback to createdAt
    return normalizeDate(o.createdAt);
  };

  // Check if buyer can complete the order
  const canComplete = () => {
    // Must be the buyer
    if (!user || order.buyerId !== user.uid) {
      return false;
    }

    // Order must not already be completed
    if (order.status === 'completed') {
      return false;
    }

    // Order must be paid
    if (order.paymentStatus !== 'paid') {
      return false;
    }

    // Check if 24 hours have passed since payment
    const now = new Date();
    const paymentRef = getPaymentReferenceDate(order);
    if (!paymentRef) {
      return false;
    }
    const eligibleAt = new Date(paymentRef.getTime() + 24 * 60 * 60 * 1000);
    if (now < eligibleAt) {
      return false;
    }

    // Check if there are any active disputes or refund requests
    if (order.hasDispute) {
      return false;
    }

    if (order.refundStatus === 'requested' || order.refundStatus === 'processing') {
      return false;
    }

    return true;
  };

  // Get time remaining until buyer can complete
  const getTimeRemaining = () => {
    if (!user || order.buyerId !== user.uid) {
      return null;
    }

    const now = new Date();
    const paymentRef = getPaymentReferenceDate(order);
    if (!paymentRef) return null;
    const completionEligibleTime = new Date(paymentRef.getTime() + 24 * 60 * 60 * 1000);

    if (now >= completionEligibleTime) {
      return null;
    }

    const hoursRemaining = Math.ceil((completionEligibleTime.getTime() - now.getTime()) / (60 * 60 * 1000));
    return hoursRemaining;
  };

  const handleCompleteOrder = async () => {
    if (!user || !canComplete()) {
      return;
    }

    setIsCompleting(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/orders/complete-by-buyer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: order.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete order');
      }

      toast.success('Order completed successfully!', {
        description: 'Thank you for confirming receipt of your order.'
      });

      // Call the callback to refresh the order data
      if (onOrderCompleted) {
        onOrderCompleted();
      }
    } catch (error) {
      console.error('Error completing order:', error);
      toast.error('Failed to complete order', {
        description: error instanceof Error ? error.message : 'Please try again later.'
      });
    } finally {
      setIsCompleting(false);
    }
  };

  // Don't show button if not the buyer
  if (!user || order.buyerId !== user.uid) {
    return null;
  }

  // Don't show button if order is already completed
  if (order.status === 'completed') {
    return null;
  }

  // Don't show button if order is not paid
  if (order.paymentStatus !== 'paid') {
    return null;
  }

  const timeRemaining = getTimeRemaining();
  const hasActiveIssues = order.hasDispute || order.refundStatus === 'requested' || order.refundStatus === 'processing';

  // Show disabled button with time remaining
  if (timeRemaining && timeRemaining > 0) {
    return (
      <Button 
        variant="outline" 
        disabled
        className="w-full"
      >
        Complete Order (Available in {timeRemaining} hour{timeRemaining !== 1 ? 's' : ''})
      </Button>
    );
  }

  // Show disabled button if there are active issues
  if (hasActiveIssues) {
    const reason = order.hasDispute 
      ? 'Cannot complete while dispute is active'
      : 'Cannot complete while refund is pending';
    
    return (
      <Button 
        variant="outline" 
        disabled
        className="w-full"
        title={reason}
      >
        Complete Order (Disabled)
      </Button>
    );
  }

  // Show active complete button
  return (
    <Button 
      onClick={handleCompleteOrder}
      disabled={isCompleting}
      className="w-full bg-green-600 hover:bg-green-700 text-white"
    >
      {isCompleting ? 'Completing...' : 'Mark as Received & Complete'}
    </Button>
  );
};

export default BuyerCompleteOrderButton;