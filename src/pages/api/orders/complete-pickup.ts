import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  qrCode?: string;
  pickupToken?: string;
  orderCompleted?: boolean;
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
    const { orderId, userId, role, pickupToken } = req.body;

    // Enhanced validation with more detailed error messages
    if (!orderId) {
      console.error('[complete-pickup] Missing orderId in request body');
      return res.status(400).json({ success: false, message: 'Missing order ID' });
    }

    if (!userId) {
      console.error('[complete-pickup] Missing userId in request body');
      return res.status(400).json({ success: false, message: 'Missing user ID' });
    }

    if (!role || (role !== 'buyer' && role !== 'seller')) {
      console.error('[complete-pickup] Invalid or missing role in request body');
      return res.status(400).json({ success: false, message: 'Invalid role. Must be "buyer" or "seller"' });
    }

    console.log(`[complete-pickup] Processing ${role} pickup confirmation for order:`, orderId, 'by user:', userId);
    
    // Get Firebase Admin services with error handling
    let db;
    try {
      const { db: firestore } = getFirebaseAdmin();
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
      buyerId: orderData.buyerId,
      isPickup: orderData.isPickup, 
      status: orderData.status,
      buyerPickupConfirmed: orderData.buyerPickupConfirmed,
      sellerPickupConfirmed: orderData.sellerPickupConfirmed,
      pickupCompleted: orderData.pickupCompleted
    });
    
    // Verify that the user is authorized for this order
    if (role === 'buyer' && orderData.buyerId !== userId) {
      console.log('[complete-pickup] Unauthorized: User is not the buyer', { 
        buyerId: orderData.buyerId, 
        userId 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only the buyer can confirm pickup as buyer' 
      });
    }

    if (role === 'seller' && orderData.sellerId !== userId) {
      console.log('[complete-pickup] Unauthorized: User is not the seller', { 
        sellerId: orderData.sellerId, 
        userId 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only the seller can confirm pickup as seller' 
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

    // Check if pickup is already completed
    if (orderData.pickupCompleted) {
      console.log('[complete-pickup] Pickup already completed for order:', orderId);
      return res.status(400).json({ success: false, message: 'Pickup has already been completed for this order' });
    }

    // Check if this role has already confirmed
    const confirmationField = role === 'buyer' ? 'buyerPickupConfirmed' : 'sellerPickupConfirmed';
    if (orderData[confirmationField]) {
      console.log(`[complete-pickup] ${role} has already confirmed pickup for order:`, orderId);
      return res.status(400).json({ error: `${role.charAt(0).toUpperCase() + role.slice(1)} has already confirmed pickup` });
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

    // If this is a seller initiating pickup, generate QR code and pickup token
    if (role === 'seller') {
      try {
        // Generate a unique pickup token
        const pickupTokenValue = `pickup_${orderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create QR code data with pickup information
        const qrData = {
          type: 'pickup_confirmation',
          orderId: orderId,
          sellerId: orderData.sellerId,
          buyerId: orderData.buyerId,
          token: pickupTokenValue,
          timestamp: Date.now(),
          listingTitle: orderData.listingSnapshot?.title || 'Unknown Item'
        };

        // Store the pickup token in the order for verification
        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
          pickupToken: pickupTokenValue,
          pickupTokenCreatedAt: FieldValue.serverTimestamp(),
          pickupTokenExpiresAt: FieldValue.serverTimestamp(), // Will be set to 24 hours from now
          sellerPickupInitiated: true,
          sellerPickupInitiatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Generate QR code URL (we'll create the QR code on the frontend)
        const qrCodeData = JSON.stringify(qrData);
        
        console.log('[complete-pickup] Seller initiated pickup, generated token:', pickupTokenValue);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Pickup initiated! Share the QR code with the buyer to complete the pickup process.',
          qrCode: qrCodeData,
          pickupToken: pickupTokenValue
        });
      } catch (updateError) {
        console.error('[complete-pickup] Error initiating pickup:', updateError);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to initiate pickup process. Please try again.',
          error: updateError instanceof Error ? updateError.message : 'Unknown error during pickup initiation'
        });
      }
    }

    // If this is a buyer confirming pickup with token
    if (role === 'buyer') {
      if (!pickupToken) {
        return res.status(400).json({ 
          success: false, 
          message: 'Pickup token is required for buyer confirmation' 
        });
      }

      // Verify the pickup token matches
      if (orderData.pickupToken !== pickupToken) {
        console.log('[complete-pickup] Invalid pickup token provided');
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid pickup token. Please scan the QR code provided by the seller.' 
        });
      }

      // Check if token has expired (24 hours)
      const tokenCreatedAt = orderData.pickupTokenCreatedAt;
      if (tokenCreatedAt) {
        const tokenAge = Date.now() - (tokenCreatedAt.seconds * 1000);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (tokenAge > twentyFourHours) {
          console.log('[complete-pickup] Pickup token has expired');
          return res.status(400).json({ 
            success: false, 
            message: 'Pickup token has expired. Please ask the seller to generate a new QR code.' 
          });
        }
      }

      try {
        // Update the order with buyer confirmation and complete the pickup
        const now = FieldValue.serverTimestamp();
        console.log('[complete-pickup] Buyer confirming pickup with valid token');
        
        const orderRef = db.collection('orders').doc(orderId);
        const updateData: any = {
          buyerPickupConfirmed: true,
          buyerPickupConfirmedAt: now,
          sellerPickupConfirmed: true, // Auto-confirm seller since they initiated with QR
          sellerPickupConfirmedAt: now,
          status: 'completed',
          pickupCompleted: true,
          pickupCompletedAt: now,
          pickupToken: null, // Clear the token after use
          pickupTokenCreatedAt: null,
          pickupTokenExpiresAt: null,
          updatedAt: now
        };
        
        console.log('[complete-pickup] Update data:', updateData);
        
        await orderRef.update(updateData);
        
        console.log('[complete-pickup] Pickup completed successfully by buyer with QR code:', orderId);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Pickup completed successfully! Both parties have confirmed the pickup and the order is now completed. You can now leave a review for this transaction.',
          orderCompleted: true
        });
      } catch (updateError) {
        console.error('[complete-pickup] Error completing pickup:', updateError);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to complete pickup. Please try again.',
          error: updateError instanceof Error ? updateError.message : 'Unknown error during pickup completion'
        });
      }
    }

    // This shouldn't be reached, but just in case
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid pickup confirmation request' 
    });

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