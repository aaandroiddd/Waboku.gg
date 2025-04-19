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
    const { orderId, carrier, trackingNumber, notes } = req.body;

    if (!orderId || !trackingNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
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