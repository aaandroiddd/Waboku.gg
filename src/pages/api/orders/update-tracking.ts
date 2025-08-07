import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { Order } from '@/types/order';
import { getTrackingInfo } from '@/lib/shipping-carriers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const { admin } = getFirebaseServices();
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;
    const { orderId, carrier, trackingNumber, notes, skipTracking } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // If skipTracking is true, we're marking as shipped without tracking
    if (skipTracking) {
      // We'll handle this case below
    } else if (!trackingNumber) {
      return res.status(400).json({ error: 'Tracking number is required' });
    }
    
    // If carrier is not provided or is 'auto-detect', we'll try to detect it
    const carrierToUse = carrier || 'auto-detect';

    // Get the order
    const { db } = getFirebaseServices();
    const orderDoc = await getDoc(doc(db, 'orders', orderId));

    if (!orderDoc.exists()) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data() as Order;

    // Check if the user is the seller
    if (orderData.sellerId !== userId) {
      return res.status(403).json({ error: 'Only the seller can update tracking information' });
    }

    // Check tracking requirements based on order value
    if (skipTracking) {
      // Check if tracking is required for high-value orders
      if (orderData.amount >= 99.99) {
        return res.status(400).json({ 
          error: 'Tracking is required for orders over $99.99. Please provide tracking information instead.' 
        });
      }
      
      // For orders without tracking, mark as completed immediately
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'completed',
        noTrackingConfirmed: true,
        trackingRequired: false,
        deliveryConfirmed: true,
        updatedAt: new Date()
      });

      console.log(`Order ${orderId} marked as completed without tracking`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Order marked as completed without tracking',
        warning: orderData.amount >= 49.99 ? 'You are responsible for any shipping issues without tracking for orders over $49.99' : undefined
      });
    }

    // Try to get initial tracking information
    let initialTrackingStatus = null;
    let detectedCarrier = carrierToUse;
    
    try {
      console.log(`Fetching initial tracking status for ${carrierToUse} ${trackingNumber}`);
      initialTrackingStatus = await getTrackingInfo(carrierToUse, trackingNumber);
      
      // If carrier was auto-detected, use the detected carrier
      if (carrierToUse === 'auto-detect' && initialTrackingStatus && initialTrackingStatus.carrier) {
        detectedCarrier = initialTrackingStatus.carrier;
        console.log(`Auto-detected carrier: ${detectedCarrier}`);
      }
    } catch (trackingError) {
      console.warn(`Could not fetch initial tracking status: ${trackingError}`);
      // Continue even if we can't get initial tracking status
    }

    // Prepare tracking info object
    const trackingInfo = {
      // Use detected carrier if available, otherwise use the provided carrier
      carrier: detectedCarrier !== 'auto-detect' ? detectedCarrier : carrier,
      trackingNumber,
      notes: notes || '',
      addedAt: new Date(),
      addedBy: userId,
      lastChecked: new Date(),
      // Include initial status information if available
      ...(initialTrackingStatus && {
        currentStatus: initialTrackingStatus.status,
        statusDescription: initialTrackingStatus.statusDescription,
        estimatedDelivery: initialTrackingStatus.estimatedDelivery,
        lastUpdate: initialTrackingStatus.lastUpdate,
        location: initialTrackingStatus.location
      })
    };

    // Determine order status based on tracking status
    // If tracking shows delivered, mark as completed
    // Otherwise, mark as shipped
    const orderStatus = initialTrackingStatus && initialTrackingStatus.status === 'delivered' ? 'completed' : 'shipped';
    
    // Update the order with tracking information
    await updateDoc(doc(db, 'orders', orderId), {
      status: orderStatus,
      trackingInfo,
      trackingRequired: true,
      // If delivered, also set deliveryConfirmed to true
      ...(orderStatus === 'completed' && { deliveryConfirmed: true }),
      updatedAt: new Date()
    });

    // Log the successful update
    console.log(`Updated tracking for order ${orderId}: ${carrier} ${trackingNumber}`);

    // Send shipping notification emails and create in-app notifications
    try {
      // Get buyer and seller data for notifications
      const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
      const { db: adminDb } = getFirebaseAdmin();
      
      const [buyerDoc, sellerDoc] = await Promise.all([
        adminDb.collection('users').doc(orderData.buyerId).get(),
        adminDb.collection('users').doc(orderData.sellerId).get()
      ]);

      const buyerData = buyerDoc.data();
      const sellerData = sellerDoc.data();

      if (buyerData && sellerData) {
        const orderNumber = orderId.substring(0, 8).toUpperCase();
        const estimatedDelivery = initialTrackingStatus?.estimatedDelivery || 'Unknown';
        const shippingAddressFormatted = orderData.shippingAddress ? 
          `${orderData.shippingAddress.name}\n${orderData.shippingAddress.line1}${orderData.shippingAddress.line2 ? '\n' + orderData.shippingAddress.line2 : ''}\n${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.postal_code}\n${orderData.shippingAddress.country}` : 
          'No shipping address provided';

        // Create tracking URL based on carrier
        let trackingUrl = '#';
        if (detectedCarrier === 'usps') {
          trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
        } else if (detectedCarrier === 'ups') {
          trackingUrl = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
        } else if (detectedCarrier === 'fedex') {
          trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
        } else if (detectedCarrier === 'dhl') {
          trackingUrl = `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
        }

        // Send shipping notification email to buyer
        if (buyerData.email) {
          const { emailService } = await import('@/lib/email-service');
          await emailService.sendShippingNotificationEmail({
            userName: buyerData.displayName || buyerData.username || 'User',
            userEmail: buyerData.email,
            sellerName: sellerData.displayName || sellerData.username || 'Seller',
            sellerLocation: sellerData.location || 'Unknown Location',
            orderNumber: orderNumber,
            trackingNumber: trackingNumber,
            shippingCarrier: detectedCarrier.toUpperCase(),
            estimatedDelivery: estimatedDelivery,
            shippingAddress: shippingAddressFormatted,
            trackingUrl: trackingUrl,
            orderId: orderId
          });
          console.log('[update-tracking] Shipping notification email sent to buyer:', buyerData.email);
        }

        // Create in-app notification for buyer about shipment
        const { notificationService } = await import('@/lib/notification-service');
        await notificationService.createNotification({
          userId: orderData.buyerId,
          type: 'order_update',
          title: '📦 Your order has shipped!',
          message: `Your order for "${orderData.listingSnapshot?.title || 'item'}" is now on its way. Tracking: ${trackingNumber}`,
          data: {
            orderId: orderId,
            trackingNumber: trackingNumber,
            actionUrl: `/dashboard/orders/${orderId}`
          }
        });
        console.log('[update-tracking] In-app notification created for buyer:', orderData.buyerId);

        // Create in-app notification for seller about successful shipment
        await notificationService.createNotification({
          userId: orderData.sellerId,
          type: 'order_update',
          title: '✅ Shipment confirmed!',
          message: `Your shipment for "${orderData.listingSnapshot?.title || 'item'}" has been processed. Tracking: ${trackingNumber}`,
          data: {
            orderId: orderId,
            trackingNumber: trackingNumber,
            actionUrl: `/dashboard/orders/${orderId}`
          }
        });
        console.log('[update-tracking] In-app notification created for seller:', orderData.sellerId);

        // Send order update notification email to seller
        if (sellerData.email) {
          const { emailService } = await import('@/lib/email-service');
          await emailService.sendEmailNotification({
            userId: orderData.sellerId,
            userEmail: sellerData.email,
            userName: sellerData.displayName || sellerData.username || 'User',
            type: 'order_update',
            title: '✅ Shipment Confirmed',
            message: `Your shipment for "${orderData.listingSnapshot?.title || 'item'}" has been processed successfully. The buyer will receive tracking information.`,
            actionUrl: `/dashboard/orders/${orderId}`,
            data: {
              orderId: orderId,
              trackingNumber: trackingNumber,
              buyerName: buyerData.displayName || buyerData.username || 'Buyer'
            }
          });
          console.log('[update-tracking] Order update email sent to seller:', sellerData.email);
        }
      }
    } catch (notificationError) {
      console.error('[update-tracking] Error sending notifications:', notificationError);
      // Don't throw error - tracking was updated successfully, notifications are secondary
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Tracking information updated successfully',
      trackingInfo,
      initialStatus: initialTrackingStatus
    });
  } catch (error) {
    console.error('Error updating tracking information:', error);
    return res.status(500).json({ 
      error: 'Failed to update tracking information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}