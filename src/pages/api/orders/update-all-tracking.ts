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
        
        // If the package is delivered, update the order status
        if (trackingStatus.status === 'delivered') {
          updateData['status'] = 'completed';
          updateData['deliveryConfirmed'] = true;
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