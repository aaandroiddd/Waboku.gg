import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get the authenticated user from the request
    const { userId } = req.body;
    
    if (!userId) {
      console.log('[update-shipping-info] No authenticated user');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.log(`[update-shipping-info] Processing request for user: ${userId}`);

    // Get request body
    const { orderId, shippingAddress } = req.body;

    if (!orderId || !shippingAddress) {
      console.log('[update-shipping-info] Missing required fields', { orderId, hasShippingAddress: !!shippingAddress });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate shipping address
    if (!shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city || 
        !shippingAddress.state || !shippingAddress.postal_code || !shippingAddress.country) {
      console.log('[update-shipping-info] Incomplete shipping address', shippingAddress);
      return res.status(400).json({ message: 'Incomplete shipping address' });
    }

    // Get Firebase admin
    const { db } = getFirebaseAdmin();

    // Get the order
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.log(`[update-shipping-info] Order not found: ${orderId}`);
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderData = orderDoc.data();

    // Check if the user is the buyer
    if (orderData?.buyerId !== userId) {
      console.log(`[update-shipping-info] User ${userId} is not the buyer of order ${orderId}`);
      return res.status(403).json({ message: 'You are not authorized to update this order' });
    }

    // Update the order with shipping information
    await orderRef.update({
      shippingAddress,
      updatedAt: new Date()
    });

    console.log(`[update-shipping-info] Successfully updated shipping info for order ${orderId}`);
    return res.status(200).json({ message: 'Shipping information updated successfully' });
  } catch (error) {
    console.error('[update-shipping-info] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}