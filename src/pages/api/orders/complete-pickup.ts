import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  order?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { orderId, userId } = req.body;

    if (!orderId || !userId) {
      console.log('[complete-pickup] Missing required fields:', { orderId, userId });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const { db } = getFirebaseServices();
    
    // Get the order document
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      console.log('[complete-pickup] Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const orderData = orderDoc.data();
    
    // Verify that the user is the seller of this order
    if (orderData.sellerId !== userId) {
      console.log('[complete-pickup] Unauthorized: User is not the seller', { sellerId: orderData.sellerId, userId });
      return res.status(403).json({ success: false, message: 'Unauthorized: Only the seller can mark an order as completed' });
    }
    
    // Verify this is a pickup order
    if (!orderData.isPickup) {
      console.log('[complete-pickup] Not a pickup order:', orderId);
      return res.status(400).json({ success: false, message: 'This operation is only valid for local pickup orders' });
    }
    
    // Verify the order is in a valid state to be completed
    const validStates = ['paid', 'awaiting_shipping'];
    if (!validStates.includes(orderData.status)) {
      console.log('[complete-pickup] Invalid order status:', orderData.status);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be completed from current status: ${orderData.status}` 
      });
    }
    
    // Update the order status to completed
    await updateDoc(orderRef, {
      status: 'completed',
      pickupCompleted: true,
      pickupCompletedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    console.log('[complete-pickup] Order marked as completed:', orderId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order marked as completed successfully',
    });
  } catch (error) {
    console.error('[complete-pickup] Error completing order:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}