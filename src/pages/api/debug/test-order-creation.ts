import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret for security
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('Invalid admin secret provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();

    // Create a test order with the provided data or defaults
    const { 
      listingId = 'test-listing-id',
      buyerId = 'test-buyer-id',
      sellerId = 'test-seller-id',
      amount = 10.99,
      sessionId = `test-session-${Date.now()}`,
      paymentIntentId = `test-payment-${Date.now()}`
    } = req.body;

    console.log('[Debug] Attempting to create test order with data:', {
      listingId,
      buyerId,
      sellerId,
      amount,
      sessionId,
      paymentIntentId
    });

    // Create order data object
    const orderData = {
      listingId,
      buyerId,
      sellerId,
      status: 'completed',
      amount,
      platformFee: 1.00,
      paymentSessionId: sessionId,
      paymentIntentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      shippingAddress: {
        name: 'Test User',
        line1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postal_code: '12345',
        country: 'US',
      },
      listingSnapshot: {
        title: 'Test Listing',
        price: amount,
        imageUrl: null
      }
    };

    // Create the order in Firestore
    console.log('[Debug] Creating order in main collection');
    let orderRef;
    try {
      orderRef = await firestoreDb.collection('orders').add(orderData);
      console.log('[Debug] Order created successfully in main collection:', {
        orderId: orderRef.id,
        path: `orders/${orderRef.id}`
      });
    } catch (orderCreateError) {
      console.error('[Debug] Failed to create order in main collection:', orderCreateError);
      throw orderCreateError;
    }
    
    // Add the order to the buyer's orders
    console.log('[Debug] Adding order to buyer collection');
    try {
      await firestoreDb.collection('users').doc(buyerId).collection('orders').doc(orderRef.id).set({
        orderId: orderRef.id,
        role: 'buyer',
        createdAt: new Date()
      });
      console.log('[Debug] Order added to buyer collection:', {
        buyerId,
        orderId: orderRef.id
      });
    } catch (buyerOrderError) {
      console.error('[Debug] Failed to add order to buyer collection:', buyerOrderError);
      // Continue execution even if this fails
    }
    
    // Add the order to the seller's orders
    console.log('[Debug] Adding order to seller collection');
    try {
      await firestoreDb.collection('users').doc(sellerId).collection('orders').doc(orderRef.id).set({
        orderId: orderRef.id,
        role: 'seller',
        createdAt: new Date()
      });
      console.log('[Debug] Order added to seller collection:', {
        sellerId,
        orderId: orderRef.id
      });
    } catch (sellerOrderError) {
      console.error('[Debug] Failed to add order to seller collection:', sellerOrderError);
      // Continue execution even if this fails
    }

    return res.status(200).json({ 
      success: true, 
      orderId: orderRef.id,
      message: 'Test order created successfully'
    });
  } catch (error) {
    console.error('[Debug] Error creating test order:', error);
    return res.status(500).json({ 
      error: 'Failed to create test order',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}