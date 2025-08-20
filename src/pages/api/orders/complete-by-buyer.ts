import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Order } from '@/types/order';
import { notificationService } from '@/lib/notification-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ 
        error: 'Missing or insufficient permissions.',
        details: 'Authorization header is required'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token using Firebase Admin
    let decodedToken;
    try {
      const { auth } = getFirebaseAdmin();
      decodedToken = await auth.verifyIdToken(token);
      console.log('Token verified successfully for user:', decodedToken.uid);
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return res.status(401).json({ 
        error: 'Missing or insufficient permissions.',
        details: 'Invalid authentication token'
      });
    }

    const userId = decodedToken.uid;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Get the order using Firebase Admin SDK
    const { db: adminDb } = getFirebaseAdmin();
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data() as Order;

    // Check if the user is the buyer
    if (orderData.buyerId !== userId) {
      return res.status(403).json({ error: 'Only the buyer can complete this order' });
    }

    // Check if order is already completed
    if (orderData.status === 'completed') {
      return res.status(400).json({ error: 'Order is already completed' });
    }

    // Check if order has been paid
    if (orderData.paymentStatus !== 'paid' && orderData.status !== 'awaiting_shipping' && orderData.status !== 'shipped') {
      return res.status(400).json({ error: 'Order must be paid before it can be completed' });
    }

    // Check if 24 hours have passed since payment
    const now = new Date();
    const paymentDate = orderData.createdAt; // Assuming payment happens at order creation
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (paymentDate > twentyFourHoursAgo) {
      const hoursRemaining = Math.ceil((paymentDate.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / (60 * 60 * 1000));
      return res.status(400).json({ 
        error: `You can complete this order in ${hoursRemaining} hour(s). Buyer completion is available 24 hours after payment.` 
      });
    }

    // Check if there are any active disputes or refund requests
    if (orderData.hasDispute) {
      return res.status(400).json({ error: 'Cannot complete order while there is an active dispute' });
    }

    if (orderData.refundStatus === 'requested' || orderData.refundStatus === 'processing') {
      return res.status(400).json({ error: 'Cannot complete order while there is an active refund request' });
    }

    // Update the order to completed status using Firebase Admin SDK
    await adminDb.collection('orders').doc(orderId).update({
      status: 'completed',
      deliveryConfirmed: true,
      buyerCompletedAt: now,
      buyerCompletedBy: userId,
      updatedAt: now
    });

    console.log(`Order ${orderId} completed by buyer ${userId}`);

    // Send notifications
    try {
      // Get buyer and seller data for notifications
      const [buyerDoc, sellerDoc] = await Promise.all([
        adminDb.collection('users').doc(orderData.buyerId).get(),
        adminDb.collection('users').doc(orderData.sellerId).get()
      ]);

      const buyerData = buyerDoc.data();
      const sellerData = sellerDoc.data();

      if (buyerData && sellerData) {
        const orderNumber = orderId.substring(0, 8).toUpperCase();
        const itemTitle = orderData.listingSnapshot?.title || 'item';

        // Create in-app notification for seller about buyer completion
        await notificationService.createNotification({
          userId: orderData.sellerId,
          type: 'order_update',
          title: '✅ Order Completed by Buyer',
          message: `${buyerData.displayName || buyerData.username || 'Buyer'} has marked the order for "${itemTitle}" as completed.`,
          data: {
            orderId: orderId,
            actionUrl: `/dashboard/orders/${orderId}`
          }
        });
        console.log('[complete-by-buyer] In-app notification created for seller:', orderData.sellerId);

        // Send delivery confirmation email to seller
        if (sellerData.email) {
          const { emailService } = await import('@/lib/email-service');
          await emailService.sendEmailNotification({
            userId: orderData.sellerId,
            userEmail: sellerData.email,
            userName: sellerData.displayName || sellerData.username || 'User',
            type: 'order_update',
            title: '✅ Order Completed by Buyer',
            message: `Great news! ${buyerData.displayName || buyerData.username || 'The buyer'} has confirmed receipt and marked your order #${orderNumber} for "${itemTitle}" as completed.`,
            actionUrl: `/dashboard/orders/${orderId}`,
            data: {
              orderId: orderId,
              buyerName: buyerData.displayName || buyerData.username || 'Buyer',
              itemTitle: itemTitle,
              orderNumber: orderNumber
            }
          });
          console.log('[complete-by-buyer] Delivery confirmation email sent to seller:', sellerData.email);
        }

        // Create in-app notification for buyer confirming completion
        await notificationService.createNotification({
          userId: orderData.buyerId,
          type: 'order_update',
          title: '✅ Order Marked as Completed',
          message: `You have successfully marked your order for "${itemTitle}" as completed. Thank you for your purchase!`,
          data: {
            orderId: orderId,
            actionUrl: `/dashboard/orders/${orderId}`
          }
        });
        console.log('[complete-by-buyer] In-app notification created for buyer:', orderData.buyerId);
      }
    } catch (notificationError) {
      console.error('[complete-by-buyer] Error sending notifications:', notificationError);
      // Don't throw error - order was completed successfully, notifications are secondary
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Order completed successfully by buyer',
      completedAt: now
    });
  } catch (error) {
    console.error('Error completing order by buyer:', error);
    return res.status(500).json({ 
      error: 'Failed to complete order',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}