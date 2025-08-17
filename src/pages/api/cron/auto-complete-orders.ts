import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { Order } from '@/types/order';
import { notificationService } from '@/lib/notification-service';

// This endpoint will be called by a cron job to automatically complete orders
// after 14 days if there are no issues (disputes, refunds, etc.)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify the cron secret to ensure this is called by the cron job
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    console.error('Invalid cron secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { db } = getFirebaseServices();
    
    // Calculate the cutoff date (14 days ago)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    console.log(`[auto-complete-orders] Looking for orders older than: ${fourteenDaysAgo.toISOString()}`);
    
    // Get all orders that are eligible for auto-completion
    // Orders must be: paid, awaiting_shipping, or shipped status
    // Orders must be older than 14 days
    // Orders must not have disputes or active refund requests
    const ordersSnapshot = await db
      .collection('orders')
      .where('paymentStatus', '==', 'paid')
      .where('createdAt', '<=', fourteenDaysAgo)
      .get();
    
    if (ordersSnapshot.empty) {
      console.log('[auto-complete-orders] No orders found for auto-completion');
      return res.status(200).json({ message: 'No orders found for auto-completion' });
    }
    
    console.log(`[auto-complete-orders] Found ${ordersSnapshot.size} potential orders for auto-completion`);
    
    const completedOrders: any[] = [];
    const skippedOrders: any[] = [];
    
    // Process each order
    for (const doc of ordersSnapshot.docs) {
      const order = doc.data() as Order;
      
      // Skip if already completed
      if (order.status === 'completed') {
        skippedOrders.push({
          orderId: order.id,
          reason: 'Already completed'
        });
        continue;
      }
      
      // Skip if order has disputes
      if (order.hasDispute) {
        skippedOrders.push({
          orderId: order.id,
          reason: 'Has active dispute'
        });
        continue;
      }
      
      // Skip if order has active refund requests
      if (order.refundStatus === 'requested' || order.refundStatus === 'processing') {
        skippedOrders.push({
          orderId: order.id,
          reason: 'Has active refund request'
        });
        continue;
      }
      
      // Skip if order is cancelled or refunded
      if (order.status === 'cancelled' || order.status === 'refunded' || order.status === 'partially_refunded') {
        skippedOrders.push({
          orderId: order.id,
          reason: 'Order is cancelled or refunded'
        });
        continue;
      }
      
      // Skip if order is not in a valid status for completion
      if (!['paid', 'awaiting_shipping', 'shipped'].includes(order.status)) {
        skippedOrders.push({
          orderId: order.id,
          reason: `Invalid status: ${order.status}`
        });
        continue;
      }
      
      try {
        console.log(`[auto-complete-orders] Auto-completing order ${order.id}`);
        
        const now = new Date();
        
        // Update the order to completed status
        await db.collection('orders').doc(order.id).update({
          status: 'completed',
          deliveryConfirmed: true,
          autoCompletedAt: now,
          updatedAt: now
        });
        
        completedOrders.push({
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          amount: order.amount,
          completedAt: now
        });
        
        // Send notifications
        try {
          // Get buyer and seller data for notifications
          const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
          const { db: adminDb } = getFirebaseAdmin();
          
          const [buyerDoc, sellerDoc] = await Promise.all([
            adminDb.collection('users').doc(order.buyerId).get(),
            adminDb.collection('users').doc(order.sellerId).get()
          ]);

          const buyerData = buyerDoc.data();
          const sellerData = sellerDoc.data();

          if (buyerData && sellerData) {
            const orderNumber = order.id.substring(0, 8).toUpperCase();
            const itemTitle = order.listingSnapshot?.title || 'item';

            // Create in-app notification for buyer about auto-completion
            await notificationService.createNotification({
              userId: order.buyerId,
              type: 'order_update',
              title: '✅ Order Automatically Completed',
              message: `Your order for "${itemTitle}" has been automatically marked as completed after 14 days. We hope you're satisfied with your purchase!`,
              data: {
                orderId: order.id,
                actionUrl: `/dashboard/orders/${order.id}`
              }
            });
            console.log('[auto-complete-orders] In-app notification created for buyer:', order.buyerId);

            // Create in-app notification for seller about auto-completion
            await notificationService.createNotification({
              userId: order.sellerId,
              type: 'order_update',
              title: '✅ Order Automatically Completed',
              message: `Your order for "${itemTitle}" has been automatically marked as completed after 14 days. Great job on the successful sale!`,
              data: {
                orderId: order.id,
                actionUrl: `/dashboard/orders/${order.id}`
              }
            });
            console.log('[auto-complete-orders] In-app notification created for seller:', order.sellerId);

            // Send auto-completion email to buyer
            if (buyerData.email) {
              const { emailService } = await import('@/lib/email-service');
              await emailService.sendEmailNotification({
                userId: order.buyerId,
                userEmail: buyerData.email,
                userName: buyerData.displayName || buyerData.username || 'User',
                type: 'order_update',
                title: '✅ Order Automatically Completed',
                message: `Your order #${orderNumber} for "${itemTitle}" has been automatically marked as completed after 14 days. We hope you're satisfied with your purchase! If you have any issues, please contact support.`,
                actionUrl: `/dashboard/orders/${order.id}`,
                data: {
                  orderId: order.id,
                  sellerName: sellerData.displayName || sellerData.username || 'Seller',
                  itemTitle: itemTitle,
                  orderNumber: orderNumber
                }
              });
              console.log('[auto-complete-orders] Auto-completion email sent to buyer:', buyerData.email);
            }

            // Send auto-completion email to seller
            if (sellerData.email) {
              const { emailService } = await import('@/lib/email-service');
              await emailService.sendEmailNotification({
                userId: order.sellerId,
                userEmail: sellerData.email,
                userName: sellerData.displayName || sellerData.username || 'User',
                type: 'order_update',
                title: '✅ Order Automatically Completed',
                message: `Your order #${orderNumber} for "${itemTitle}" has been automatically marked as completed after 14 days. Congratulations on the successful sale!`,
                actionUrl: `/dashboard/orders/${order.id}`,
                data: {
                  orderId: order.id,
                  buyerName: buyerData.displayName || buyerData.username || 'Buyer',
                  itemTitle: itemTitle,
                  orderNumber: orderNumber
                }
              });
              console.log('[auto-complete-orders] Auto-completion email sent to seller:', sellerData.email);
            }
          }
        } catch (notificationError) {
          console.error('[auto-complete-orders] Error sending notifications for order:', order.id, notificationError);
          // Don't throw error - order was completed successfully, notifications are secondary
        }
        
      } catch (error) {
        console.error(`[auto-complete-orders] Error auto-completing order ${order.id}:`, error);
        skippedOrders.push({
          orderId: order.id,
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    console.log(`[auto-complete-orders] Successfully auto-completed ${completedOrders.length} orders`);
    console.log(`[auto-complete-orders] Skipped ${skippedOrders.length} orders`);
    
    return res.status(200).json({
      success: true,
      message: `Successfully auto-completed ${completedOrders.length} orders`,
      completedOrders,
      skippedOrders,
      summary: {
        totalProcessed: ordersSnapshot.size,
        completed: completedOrders.length,
        skipped: skippedOrders.length
      }
    });
  } catch (error) {
    console.error('[auto-complete-orders] Error in auto-completion process:', error);
    return res.status(500).json({
      error: 'Failed to auto-complete orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}