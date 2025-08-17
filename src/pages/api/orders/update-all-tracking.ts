import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { getTrackingInfo } from '@/lib/shipping-carriers';
import { Order } from '@/types/order';

// This endpoint will be called by a cron job to update tracking information
// for all active shipments

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify the cron secret to ensure this is called by the cron job
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    console.error('Invalid cron secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { db } = getFirebaseServices();
    
    // Get all orders with tracking information that are not delivered or completed
    const ordersSnapshot = await db
      .collection('orders')
      .where('status', '==', 'shipped')
      .where('trackingInfo', '!=', null)
      .get();
    
    if (ordersSnapshot.empty) {
      console.log('No active shipments found to update');
      return res.status(200).json({ message: 'No active shipments found to update' });
    }
    
    console.log(`Found ${ordersSnapshot.size} active shipments to update`);
    
    const updatePromises: Promise<any>[] = [];
    const updatedOrders: any[] = [];
    
    // Process each order
    for (const doc of ordersSnapshot.docs) {
      const order = doc.data() as Order;
      
      // Skip if no tracking info
      if (!order.trackingInfo?.trackingNumber) {
        continue;
      }
      
      // Skip if already delivered (status is stored in trackingInfo.currentStatus)
      if (order.trackingInfo.currentStatus === 'delivered') {
        continue;
      }
      
      const { carrier = 'auto-detect', trackingNumber } = order.trackingInfo;
      
      try {
        console.log(`Updating tracking for order ${order.id}: ${carrier} ${trackingNumber}`);
        
        // Get latest tracking information
        const trackingStatus = await getTrackingInfo(carrier, trackingNumber);
        
        // Prepare update data
        const updateData: any = {
          'trackingInfo.lastChecked': new Date(),
          'trackingInfo.currentStatus': trackingStatus.status,
          'trackingInfo.statusDescription': trackingStatus.statusDescription,
        };
        
        // Add optional fields if present
        if (trackingStatus.estimatedDelivery) {
          updateData['trackingInfo.estimatedDelivery'] = trackingStatus.estimatedDelivery;
        }
        
        if (trackingStatus.lastUpdate) {
          updateData['trackingInfo.lastUpdate'] = trackingStatus.lastUpdate;
        }
        
        if (trackingStatus.location) {
          updateData['trackingInfo.location'] = trackingStatus.location;
        }
        
        if (trackingStatus.events && trackingStatus.events.length > 0) {
          updateData['trackingInfo.events'] = trackingStatus.events;
        }
        
        // If the package is delivered or has any other status, update accordingly
        if (trackingStatus.status === 'delivered') {
          updateData['status'] = 'completed';
          updateData['deliveryConfirmed'] = true;
          updateData['updatedAt'] = new Date();
          
          // Send delivery confirmation notifications
          try {
            // Get buyer and seller data for delivery notifications
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

              // Create in-app notification for buyer about delivery
              const { notificationService } = await import('@/lib/notification-service');
              await notificationService.createNotification({
                userId: order.buyerId,
                type: 'order_update',
                title: '📦 Package Delivered!',
                message: `Your order for "${itemTitle}" has been delivered! The order has been automatically marked as completed.`,
                data: {
                  orderId: order.id,
                  actionUrl: `/dashboard/orders/${order.id}`
                }
              });
              console.log('[update-all-tracking] Delivery notification created for buyer:', order.buyerId);

              // Create in-app notification for seller about delivery
              await notificationService.createNotification({
                userId: order.sellerId,
                type: 'order_update',
                title: '✅ Package Delivered!',
                message: `Your package for "${itemTitle}" has been delivered to the buyer. The order has been automatically completed.`,
                data: {
                  orderId: order.id,
                  actionUrl: `/dashboard/orders/${order.id}`
                }
              });
              console.log('[update-all-tracking] Delivery notification created for seller:', order.sellerId);

              // Send delivery confirmation email to buyer
              if (buyerData.email) {
                const { emailService } = await import('@/lib/email-service');
                await emailService.sendEmailNotification({
                  userId: order.buyerId,
                  userEmail: buyerData.email,
                  userName: buyerData.displayName || buyerData.username || 'User',
                  type: 'order_update',
                  title: '📦 Package Delivered!',
                  message: `Great news! Your order #${orderNumber} for "${itemTitle}" has been delivered and automatically marked as completed. We hope you're satisfied with your purchase!`,
                  actionUrl: `/dashboard/orders/${order.id}`,
                  data: {
                    orderId: order.id,
                    sellerName: sellerData.displayName || sellerData.username || 'Seller',
                    itemTitle: itemTitle,
                    orderNumber: orderNumber,
                    trackingNumber: trackingNumber
                  }
                });
                console.log('[update-all-tracking] Delivery confirmation email sent to buyer:', buyerData.email);
              }

              // Send delivery confirmation email to seller
              if (sellerData.email) {
                const { emailService } = await import('@/lib/email-service');
                await emailService.sendEmailNotification({
                  userId: order.sellerId,
                  userEmail: sellerData.email,
                  userName: sellerData.displayName || sellerData.username || 'User',
                  type: 'order_update',
                  title: '✅ Package Delivered Successfully!',
                  message: `Excellent! Your package for order #${orderNumber} "${itemTitle}" has been delivered to ${buyerData.displayName || buyerData.username || 'the buyer'}. The order has been automatically completed.`,
                  actionUrl: `/dashboard/orders/${order.id}`,
                  data: {
                    orderId: order.id,
                    buyerName: buyerData.displayName || buyerData.username || 'Buyer',
                    itemTitle: itemTitle,
                    orderNumber: orderNumber,
                    trackingNumber: trackingNumber
                  }
                });
                console.log('[update-all-tracking] Delivery confirmation email sent to seller:', sellerData.email);
              }
            }
          } catch (deliveryNotificationError) {
            console.error('[update-all-tracking] Error sending delivery notifications for order:', order.id, deliveryNotificationError);
            // Don't throw error - tracking was updated successfully, notifications are secondary
          }
        } else {
          // For any other status, ensure we're updating the status badge information
          // but keep the order status as 'shipped'
          updateData['updatedAt'] = new Date();
        }
        
        // Add the update promise to our array
        updatePromises.push(
          db.collection('orders').doc(order.id).update(updateData)
            .then(() => {
              updatedOrders.push({
                orderId: order.id,
                carrier,
                trackingNumber,
                newStatus: trackingStatus.status
              });
            })
            .catch(error => {
              console.error(`Error updating order ${order.id}:`, error);
              return {
                orderId: order.id,
                error: error.message
              };
            })
        );
      } catch (error) {
        console.error(`Error processing tracking for order ${order.id}:`, error);
      }
    }
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);
    
    console.log(`Successfully updated ${updatedOrders.length} orders`);
    
    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedOrders.length} orders`,
      updatedOrders
    });
  } catch (error) {
    console.error('Error updating tracking information:', error);
    return res.status(500).json({
      error: 'Failed to update tracking information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}