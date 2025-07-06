import { Order } from '@/types/order';
import { addDays } from 'date-fns';

export interface OrderAttentionInfo {
  needsAttention: boolean;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  actionRequired: string;
}

/**
 * Determines if an order needs attention and what kind of attention it needs
 */
export function getOrderAttentionInfo(order: Order, isSale: boolean = false): OrderAttentionInfo {
  // High priority issues (urgent action required)
  
  // 1. Awaiting payment (for buyers)
  if (!isSale && order.paymentStatus === 'awaiting_payment' && !order.isPickup) {
    return {
      needsAttention: true,
      priority: 'high',
      reason: 'Payment required',
      actionRequired: 'Complete payment to proceed with your order'
    };
  }
  
  // 2. Refund requested (for sellers)
  if (isSale && order.refundStatus === 'requested') {
    return {
      needsAttention: true,
      priority: 'high',
      reason: 'Refund requested',
      actionRequired: 'Review and respond to refund request'
    };
  }
  
  // 3. Missing shipping details (for buyers)
  if (!isSale && order.status === 'awaiting_shipping' && !order.shippingAddress && !order.isPickup) {
    return {
      needsAttention: true,
      priority: 'high',
      reason: 'Shipping details required',
      actionRequired: 'Provide shipping address to continue'
    };
  }
  
  // 4. Pickup ready for completion (for sellers)
  if (isSale && order.isPickup && !order.pickupCompleted && 
      (order.status === 'paid' || order.status === 'awaiting_shipping' || 
       (order.status === 'pending' && order.paymentRequired === false))) {
    return {
      needsAttention: true,
      priority: 'high',
      reason: 'Pickup ready',
      actionRequired: 'Mark as completed when buyer picks up item'
    };
  }
  
  // 4b. Pickup awaiting for buyers
  if (!isSale && order.isPickup && !order.pickupCompleted && 
      (order.status === 'paid' || order.status === 'awaiting_shipping' || 
       (order.status === 'pending' && order.paymentRequired === false))) {
    return {
      needsAttention: true,
      priority: 'medium',
      reason: 'Awaiting Pickup',
      actionRequired: 'This item is ready for pickup'
    };
  }
  
  // Medium priority issues (action needed but not urgent)
  
  // 5. Tracking required (for sellers)
  if (isSale && order.status === 'shipped' && order.trackingRequired && !order.trackingInfo && !order.noTrackingConfirmed) {
    return {
      needsAttention: true,
      priority: 'medium',
      reason: 'Tracking information needed',
      actionRequired: 'Add tracking information or confirm no tracking available'
    };
  }
  
  // 6. Ready to ship (for sellers)
  if (isSale && order.status === 'awaiting_shipping' && order.shippingAddress && !order.isPickup) {
    return {
      needsAttention: true,
      priority: 'medium',
      reason: 'Ready to ship',
      actionRequired: 'Ship the item and update order status'
    };
  }
  
  // 7. Review pending (for buyers)
  if (!isSale && order.status === 'completed' && !order.reviewSubmitted) {
    return {
      needsAttention: true,
      priority: 'medium',
      reason: 'Review pending',
      actionRequired: 'Leave a review for this transaction'
    };
  }
  
  // Low priority issues (informational)
  
  // 8. Refund processing
  if (order.refundStatus === 'processing') {
    return {
      needsAttention: true,
      priority: 'low',
      reason: 'Refund processing',
      actionRequired: 'Refund is being processed, no action needed'
    };
  }
  
  // 9. Pending orders without specific issues (exclude pickup orders)
  if (order.status === 'pending' && !order.paymentStatus && !order.isPickup) {
    return {
      needsAttention: true,
      priority: 'low',
      reason: 'Order pending',
      actionRequired: 'Order is being processed'
    };
  }
  
  // No attention needed
  return {
    needsAttention: false,
    priority: 'low',
    reason: '',
    actionRequired: ''
  };
}

/**
 * Sorts orders by attention priority and then by date
 */
export function sortOrdersByAttention(orders: Order[], isSale: boolean = false): Order[] {
  return [...orders].sort((a, b) => {
    const aAttention = getOrderAttentionInfo(a, isSale);
    const bAttention = getOrderAttentionInfo(b, isSale);
    
    // First sort by attention needed
    if (aAttention.needsAttention && !bAttention.needsAttention) return -1;
    if (!aAttention.needsAttention && bAttention.needsAttention) return 1;
    
    // If both need attention, sort by priority
    if (aAttention.needsAttention && bAttention.needsAttention) {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[aAttention.priority] - priorityOrder[bAttention.priority];
      if (priorityDiff !== 0) return priorityDiff;
    }
    
    // Finally sort by date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Gets a count of orders that need attention by priority
 */
export function getAttentionCounts(orders: Order[], isSale: boolean = false) {
  const counts = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0
  };
  
  orders.forEach(order => {
    const attention = getOrderAttentionInfo(order, isSale);
    if (attention.needsAttention) {
      counts.total++;
      counts[attention.priority]++;
    }
  });
  
  return counts;
}