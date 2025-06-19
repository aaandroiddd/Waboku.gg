import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { emailService } from '@/lib/email-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, reason, userId } = req.body;

    if (!orderId || !reason || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'orderId, reason, and userId are required'
      });
    }

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    // Get the order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();
    
    // Verify the user is the buyer
    if (orderData?.buyerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You can only request refunds for your own orders' });
    }

    // Check if order is eligible for refund
    const eligibilityCheck = checkRefundEligibility(orderData);
    if (!eligibilityCheck.eligible) {
      return res.status(400).json({ 
        error: 'Order not eligible for refund',
        details: eligibilityCheck.reason
      });
    }

    // Check if refund already requested
    if (orderData?.refundStatus && orderData.refundStatus !== 'none') {
      return res.status(400).json({ 
        error: 'Refund already requested',
        details: `Current refund status: ${orderData.refundStatus}`
      });
    }

    // Update order with refund request
    const refundRequestData = {
      refundStatus: 'requested',
      refundReason: reason,
      refundRequestedAt: new Date(),
      updatedAt: new Date()
    };

    await orderDoc.ref.update(refundRequestData);

    // Get buyer and seller information for notifications
    const [buyerDoc, sellerDoc] = await Promise.all([
      db.collection('users').doc(orderData.buyerId).get(),
      db.collection('users').doc(orderData.sellerId).get()
    ]);

    const buyerData = buyerDoc.data();
    const sellerData = sellerDoc.data();

    // Send notifications
    try {
      // Import notification service
      const { notificationService } = await import('@/lib/notification-service');
      
      // Notify buyer that refund request was submitted
      await notificationService.createNotification({
        userId: orderData.buyerId,
        type: 'order_update',
        title: '🔄 Refund Request Submitted',
        message: `Your refund request for "${orderData.listingSnapshot?.title || 'your order'}" has been submitted and is being reviewed.`,
        data: {
          orderId: orderId,
          actionUrl: `/dashboard/orders/${orderId}`
        }
      });

      // Notify seller about refund request
      await notificationService.createNotification({
        userId: orderData.sellerId,
        type: 'order_update',
        title: '⚠️ Refund Request Received',
        message: `${buyerData?.displayName || buyerData?.username || 'A buyer'} has requested a refund for "${orderData.listingSnapshot?.title || 'an order'}". Reason: ${reason}`,
        data: {
          orderId: orderId,
          actionUrl: `/dashboard/orders/${orderId}`
        }
      });

      console.log('[Refund Request] In-app notifications sent for order:', orderId);
    } catch (notificationError) {
      console.error('[Refund Request] Error sending notifications:', notificationError);
    }

    // Send email notifications
    try {
      if (buyerData?.email) {
        await emailService.sendEmailNotification({
          userId: orderData.buyerId,
          userEmail: buyerData.email,
          userName: buyerData.displayName || buyerData.username || 'User',
          type: 'order_update',
          title: '🔄 Refund Request Submitted',
          message: `Your refund request for "${orderData.listingSnapshot?.title || 'your order'}" has been submitted and is being reviewed. You will receive an update once the seller or our team reviews your request.`,
          actionUrl: `/dashboard/orders/${orderId}`,
          data: {
            orderId: orderId,
            reason: reason,
            orderTitle: orderData.listingSnapshot?.title || 'Order'
          }
        });
        console.log('[Refund Request] Email sent to buyer:', buyerData.email);
      }

      if (sellerData?.email) {
        await emailService.sendEmailNotification({
          userId: orderData.sellerId,
          userEmail: sellerData.email,
          userName: sellerData.displayName || sellerData.username || 'User',
          type: 'order_update',
          title: '⚠️ Refund Request Received',
          message: `${buyerData?.displayName || buyerData?.username || 'A buyer'} has requested a refund for "${orderData.listingSnapshot?.title || 'an order'}". Please review the request and respond accordingly.`,
          actionUrl: `/dashboard/orders/${orderId}`,
          data: {
            orderId: orderId,
            reason: reason,
            buyerName: buyerData?.displayName || buyerData?.username || 'Buyer',
            orderTitle: orderData.listingSnapshot?.title || 'Order'
          }
        });
        console.log('[Refund Request] Email sent to seller:', sellerData.email);
      }
    } catch (emailError) {
      console.error('[Refund Request] Error sending emails:', emailError);
    }

    console.log('[Refund Request] Successfully processed refund request:', {
      orderId,
      buyerId: orderData.buyerId,
      sellerId: orderData.sellerId,
      reason
    });

    res.status(200).json({ 
      success: true,
      message: 'Refund request submitted successfully',
      refundStatus: 'requested'
    });

  } catch (error) {
    console.error('[Refund Request] Error processing refund request:', error);
    res.status(500).json({ 
      error: 'Failed to process refund request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to check if an order is eligible for refund
function checkRefundEligibility(orderData: any): { eligible: boolean; reason?: string } {
  // Check if order exists and has required data
  if (!orderData) {
    return { eligible: false, reason: 'Order data not found' };
  }

  // Check if order has been paid
  if (!orderData.paymentIntentId && !orderData.paymentSessionId) {
    return { eligible: false, reason: 'Order has not been paid' };
  }

  // Check if order is already refunded
  if (orderData.status === 'refunded' || orderData.status === 'partially_refunded') {
    return { eligible: false, reason: 'Order has already been refunded' };
  }

  // Check if order is cancelled
  if (orderData.status === 'cancelled') {
    return { eligible: false, reason: 'Cancelled orders cannot be refunded' };
  }

  // Check if this is a pickup order that has been completed
  if (orderData.isPickup && orderData.pickupCompleted) {
    return { eligible: false, reason: 'Pickup orders cannot be refunded after completion' };
  }

  // Check refund deadline (30 days from order creation)
  const orderCreatedAt = orderData.createdAt?.toDate?.() || new Date(orderData.createdAt);
  const refundDeadline = new Date(orderCreatedAt);
  refundDeadline.setDate(refundDeadline.getDate() + 30); // 30 days to request refund
  
  if (new Date() > refundDeadline) {
    return { eligible: false, reason: 'Refund deadline has passed (30 days from order date)' };
  }

  // Order is eligible for refund
  return { eligible: true };
}