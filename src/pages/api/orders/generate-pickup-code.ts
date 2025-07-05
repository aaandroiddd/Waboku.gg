import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  pickupCode?: string;
  expiresAt?: string;
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
      console.error('[generate-pickup-code] Missing orderId in request body');
      return res.status(400).json({ success: false, message: 'Missing order ID' });
    }

    if (!userId) {
      console.error('[generate-pickup-code] Missing userId in request body');
      return res.status(400).json({ success: false, message: 'Missing user ID' });
    }

    console.log(`[generate-pickup-code] Generating 6-digit code for order:`, orderId, 'by user:', userId);
    
    // Get Firebase Admin services with error handling
    let db;
    try {
      const { db: firestore } = getFirebaseAdmin();
      db = firestore;
      if (!db) {
        throw new Error('Firebase database not initialized');
      }
    } catch (firebaseError) {
      console.error('[generate-pickup-code] Firebase initialization error:', firebaseError);
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
      console.error('[generate-pickup-code] Error fetching order document:', docError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve order information', 
        error: 'Database query failed'
      });
    }
    
    if (!orderDoc.exists) {
      console.log('[generate-pickup-code] Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const orderData = orderDoc.data();
    
    // Validate order data
    if (!orderData) {
      console.error('[generate-pickup-code] Order data is empty for order:', orderId);
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid order data', 
        error: 'Order data is empty'
      });
    }
    
    console.log('[generate-pickup-code] Order data:', { 
      orderId, 
      sellerId: orderData.sellerId,
      buyerId: orderData.buyerId,
      isPickup: orderData.isPickup, 
      status: orderData.status,
      pickupCompleted: orderData.pickupCompleted
    });
    
    // Verify that the user is the seller for this order
    if (orderData.sellerId !== userId) {
      console.log('[generate-pickup-code] Unauthorized: User is not the seller', { 
        sellerId: orderData.sellerId, 
        userId 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only the seller can generate pickup codes' 
      });
    }
    
    // Verify this is a pickup order
    if (orderData.isPickup !== true) {
      console.log('[generate-pickup-code] Not a pickup order:', orderId);
      return res.status(400).json({ 
        success: false, 
        message: 'This operation is only valid for local pickup orders' 
      });
    }

    // Check if pickup is already completed
    if (orderData.pickupCompleted) {
      console.log('[generate-pickup-code] Pickup already completed for order:', orderId);
      return res.status(400).json({ success: false, message: 'Pickup has already been completed for this order' });
    }
    
    // Verify the order is in a valid state to be completed
    const validStates = ['paid', 'awaiting_shipping', 'pending'];
    if (!validStates.includes(orderData.status)) {
      console.log('[generate-pickup-code] Invalid order status:', orderData.status);
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be completed from current status: ${orderData.status}` 
      });
    }

    // Check if there's already an active pickup code
    if (orderData.pickupCode && orderData.pickupCodeExpiresAt) {
      const expiresAt = orderData.pickupCodeExpiresAt.toDate ? orderData.pickupCodeExpiresAt.toDate() : new Date(orderData.pickupCodeExpiresAt);
      const now = new Date();
      
      if (expiresAt > now) {
        console.log('[generate-pickup-code] Returning existing active code:', orderData.pickupCode);
        return res.status(200).json({ 
          success: true, 
          message: 'Active pickup code retrieved! Share this code with the buyer.',
          pickupCode: orderData.pickupCode,
          expiresAt: expiresAt.toISOString(),
          isExisting: true
        });
      } else {
        console.log('[generate-pickup-code] Existing code has expired, generating new one');
      }
    }

    try {
      // Generate a unique 6-digit pickup code
      const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration time to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      // Store the pickup code in the order for verification
      const orderRef = db.collection('orders').doc(orderId);
      await orderRef.update({
        pickupCode: pickupCode,
        pickupCodeCreatedAt: FieldValue.serverTimestamp(),
        pickupCodeExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        sellerPickupInitiated: true,
        sellerPickupInitiatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log('[generate-pickup-code] Generated 6-digit code:', pickupCode, 'expires at:', expiresAt.toISOString());
      
      return res.status(200).json({ 
        success: true, 
        message: '6-digit pickup code generated successfully! Share this code with the buyer.',
        pickupCode: pickupCode,
        expiresAt: expiresAt.toISOString(),
        isExisting: false
      });
    } catch (updateError) {
      console.error('[generate-pickup-code] Error generating pickup code:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate pickup code. Please try again.',
        error: updateError instanceof Error ? updateError.message : 'Unknown error during code generation'
      });
    }

  } catch (error) {
    // Improved error logging with more details
    console.error('[generate-pickup-code] Unhandled error:', error);
    console.error('[generate-pickup-code] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[generate-pickup-code] Request body:', req.body);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}