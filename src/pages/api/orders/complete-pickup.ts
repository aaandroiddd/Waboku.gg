import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  order?: any;
  error?: string;
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

    // Enhanced validation with more detailed error messages
    if (!orderId) {
      console.error('[complete-pickup] Missing orderId in request body');
      return res.status(400).json({ success: false, message: 'Missing order ID' });
    }

    if (!userId) {
      console.error('[complete-pickup] Missing userId in request body');
      return res.status(400).json({ success: false, message: 'Missing user ID' });
    }

    console.log('[complete-pickup] Processing request:', { orderId, userId });
    
    // Get Firebase Admin services with error handling
    let db;
    try {
      const { db: firestore } = initializeFirebaseAdmin();
      db = firestore;
      if (!db) {
        throw new Error('Firebase database not initialized');
      }
    } catch (firebaseError) {
      console.error('[complete-pickup] Firebase initialization error:', firebaseError);
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error', 
        error: 'Failed to initialize Firebase'
      });
    }
    
    // Get the order document with error handling
    let orderDoc;
    try {
      const orderRef = db.collection('orders').doc(orderId);
      orderDoc = await orderRef.get();
    } catch (docError) {
      console.error('[complete-pickup] Error fetching order document:', docError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve order information', 
        error: 'Database query failed'
      });
    }
    
    if (!orderDoc.exists) {
      console.log('[complete-pickup] Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const orderData = orderDoc.data();
    
    // Validate order data
    if (!orderData) {
      console.error('[complete-pickup] Order data is empty for order:', orderId);
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid order data', 
        error: 'Order data is empty'
      });
    }
    
    console.log('[complete-pickup] Order data:', { 
      orderId, 
      sellerId: orderData.sellerId, 
      isPickup: orderData.isPickup, 
      status: orderData.status 
    });
    
    // Verify that the user is the seller of this order
    if (orderData.sellerId !== userId) {
      console.log('[complete-pickup] Unauthorized: User is not the seller', { 
        sellerId: orderData.sellerId, 
        userId 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only the seller can mark an order as completed' 
      });
    }
    
    // Verify this is a pickup order
    if (orderData.isPickup !== true) {
      console.log('[complete-pickup] Not a pickup order:', orderId);
      return res.status(400).json({ 
        success: false, 
        message: 'This operation is only valid for local pickup orders' 
      });
    }
    
    // Verify the order is in a valid state to be completed
    const validStates = ['paid', 'awaiting_shipping', 'pending'];
    if (!validStates.includes(orderData.status)) {
      console.log('[complete-pickup] Invalid order status:', orderData.status);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be completed from current status: ${orderData.status}` 
      });
    }
    
    try {
      // Update the order with seller confirmation
      const now = Timestamp.now();
      console.log('[complete-pickup] Updating order with seller confirmation timestamp:', now);
      
      const orderRef = db.collection('orders').doc(orderId);
      const updateData: any = {
        sellerPickupConfirmed: true,
        sellerPickupConfirmedAt: now,
        updatedAt: now
      };
      
      // Check if buyer has already confirmed
      const buyerAlreadyConfirmed = orderData.buyerPickupConfirmed;
      
      if (buyerAlreadyConfirmed) {
        // Both parties have confirmed, complete the order
        updateData.status = 'completed';
        updateData.pickupCompleted = true;
        updateData.pickupCompletedAt = now;
        console.log('[complete-pickup] Both parties confirmed, completing order');
      }
      
      console.log('[complete-pickup] Update data:', updateData);
      
      await orderRef.update(updateData);
      
      const responseMessage = buyerAlreadyConfirmed 
        ? 'Pickup completed! Both parties have confirmed pickup and the order is now completed. Reviews can now be left for this transaction.'
        : 'Pickup confirmed by seller! Waiting for the buyer to also confirm pickup before completing the order.';
      
      console.log('[complete-pickup] Order updated successfully:', orderId);
      
      return res.status(200).json({ 
        success: true, 
        message: responseMessage,
      });
    } catch (updateError) {
      console.error('[complete-pickup] Error updating order document:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update order status. Please try again.',
        error: updateError instanceof Error ? updateError.message : 'Unknown error during update'
      });
    }
  } catch (error) {
    // Improved error logging with more details
    console.error('[complete-pickup] Unhandled error:', error);
    console.error('[complete-pickup] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[complete-pickup] Request body:', req.body);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}