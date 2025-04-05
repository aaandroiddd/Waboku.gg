import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

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
    
    // Get Firebase services with error handling
    let db;
    try {
      const services = getFirebaseServices();
      db = services.db;
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
      const orderRef = doc(db, 'orders', orderId);
      orderDoc = await getDoc(orderRef);
    } catch (docError) {
      console.error('[complete-pickup] Error fetching order document:', docError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve order information', 
        error: 'Database query failed'
      });
    }
    
    if (!orderDoc.exists()) {
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
    const validStates = ['paid', 'awaiting_shipping'];
    if (!validStates.includes(orderData.status)) {
      console.log('[complete-pickup] Invalid order status:', orderData.status);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be completed from current status: ${orderData.status}` 
      });
    }
    
    try {
      // Update the order status to completed
      const now = Timestamp.now();
      console.log('[complete-pickup] Updating order with timestamp:', now);
      
      const orderRef = doc(db, 'orders', orderId);
      const updateData = {
        status: 'completed',
        pickupCompleted: true,
        pickupCompletedAt: now,
        updatedAt: now
      };
      
      console.log('[complete-pickup] Update data:', updateData);
      
      await updateDoc(orderRef, updateData);
      
      console.log('[complete-pickup] Order marked as completed successfully:', orderId);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Order marked as completed successfully. The buyer can now leave a review for this transaction.',
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