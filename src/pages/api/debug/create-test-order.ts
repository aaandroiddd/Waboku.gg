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

  // This endpoint should only be used in development
  if (process.env.NEXT_PUBLIC_CO_DEV_ENV !== 'development') {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }

  try {
    const { buyerId, sellerId, listingId } = req.body;

    if (!buyerId || !sellerId || !listingId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    // Get the listing data
    const listingDoc = await db.collection('listings').doc(listingId).get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();

    // Create a test order
    const orderData = {
      listingId,
      buyerId,
      sellerId,
      status: 'completed',
      amount: listingData.price || 10.00,
      platformFee: (listingData.price * 0.1) || 1.00, // 10% platform fee
      paymentSessionId: 'test_session_' + Date.now(),
      paymentIntentId: 'test_intent_' + Date.now(),
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
      // Add the listing snapshot for display in the orders page
      listingSnapshot: {
        title: listingData.title || 'Test Listing',
        price: listingData.price || 10.00,
        imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null
      }
    };

    console.log('[Debug] Creating test order:', orderData);

    // Create the order in Firestore
    const orderRef = await db.collection('orders').add(orderData);
    
    console.log('[Debug] Test order created in main collection:', {
      orderId: orderRef.id
    });
    
    // Add the order to the buyer's orders
    await db.collection('users').doc(buyerId).collection('orders').doc(orderRef.id).set({
      orderId: orderRef.id,
      role: 'buyer',
      createdAt: new Date()
    });
    
    console.log('[Debug] Test order added to buyer collection:', {
      buyerId,
      orderId: orderRef.id
    });
    
    // Add the order to the seller's orders
    await db.collection('users').doc(sellerId).collection('orders').doc(orderRef.id).set({
      orderId: orderRef.id,
      role: 'seller',
      createdAt: new Date()
    });
    
    console.log('[Debug] Test order added to seller collection:', {
      sellerId,
      orderId: orderRef.id
    });

    return res.status(200).json({ 
      success: true, 
      orderId: orderRef.id,
      message: 'Test order created successfully'
    });
  } catch (error: any) {
    console.error('[Debug] Error creating test order:', error);
    return res.status(500).json({ 
      error: error.message || 'Error creating test order',
      code: error.code || 'unknown_error'
    });
  }
}