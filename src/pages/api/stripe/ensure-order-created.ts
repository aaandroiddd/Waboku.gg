import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Ensure Order Created] Request received:', {
    method: req.method,
    query: req.query,
    body: req.body
  });

  if (req.method !== 'POST') {
    console.log('[Ensure Order Created] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      console.error('[Ensure Order Created] Missing session ID');
      return res.status(400).json({
        error: 'Missing session ID',
        message: 'Session ID is required'
      });
    }

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();

    // First check if an order with this payment session already exists
    const existingOrdersQuery = await firestoreDb.collection('orders')
      .where('paymentSessionId', '==', sessionId)
      .limit(1)
      .get();
    
    if (!existingOrdersQuery.empty) {
      const existingOrder = existingOrdersQuery.docs[0];
      console.log('[Ensure Order Created] Order already exists for this session:', {
        orderId: existingOrder.id,
        paymentSessionId: sessionId
      });
      
      return res.status(200).json({ 
        success: true,
        message: 'Order already exists',
        orderId: existingOrder.id,
        orderData: existingOrder.data()
      });
    }

    // If no order exists, retrieve the checkout session from Stripe
    console.log('[Ensure Order Created] No order found, retrieving checkout session:', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent']
    });

    if (!session) {
      console.error('[Ensure Order Created] Session not found:', sessionId);
      return res.status(404).json({
        error: 'Session not found',
        message: 'Could not find the checkout session'
      });
    }

    // Check if this is a marketplace purchase (has listingId, buyerId, sellerId in metadata)
    if (!session.metadata?.listingId || !session.metadata?.buyerId || !session.metadata?.sellerId) {
      console.error('[Ensure Order Created] Not a marketplace purchase session:', {
        sessionId,
        metadata: session.metadata
      });
      return res.status(400).json({
        error: 'Not a marketplace purchase',
        message: 'This session is not for a marketplace purchase'
      });
    }

    // Check if the payment was successful
    if (session.payment_status !== 'paid') {
      console.error('[Ensure Order Created] Payment not completed:', {
        sessionId,
        paymentStatus: session.payment_status
      });
      return res.status(400).json({
        error: 'Payment not completed',
        message: 'The payment has not been completed yet'
      });
    }

    // Extract the necessary data
    const { listingId, buyerId, sellerId } = session.metadata;
    const paymentIntentId = session.payment_intent as string;

    console.log('[Ensure Order Created] Creating order for successful checkout:', {
      sessionId,
      listingId,
      buyerId,
      sellerId,
      paymentIntentId
    });

    // Update the listing status to sold if it's not already
    const listingRef = firestoreDb.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.error('[Ensure Order Created] Listing not found:', listingId);
      return res.status(404).json({
        error: 'Listing not found',
        message: 'The listing associated with this purchase could not be found'
      });
    }

    const listingData = listingDoc.data();
    
    // Only update if the listing is not already sold
    if (listingData?.status !== 'sold') {
      await listingRef.update({
        status: 'sold',
        soldAt: new Date(),
        soldTo: buyerId,
        paymentSessionId: sessionId,
        paymentIntentId: paymentIntentId,
        updatedAt: new Date()
      });
      
      console.log('[Ensure Order Created] Listing marked as sold:', {
        listingId,
        status: 'sold',
        soldTo: buyerId
      });
    } else {
      console.log('[Ensure Order Created] Listing already marked as sold:', {
        listingId,
        status: listingData.status
      });
    }

    // Check if this order came from an accepted offer
    let offerPrice = null;
    if (session.metadata?.offerId) {
      try {
        const offerDoc = await firestoreDb.collection('offers').doc(session.metadata.offerId).get();
        if (offerDoc.exists) {
          const offerData = offerDoc.data();
          offerPrice = offerData.amount;
          console.log(`[Ensure Order Created] Found offer price: ${offerPrice} for offer ID: ${session.metadata.offerId}`);
        }
      } catch (err) {
        console.error('[Ensure Order Created] Error fetching offer data:', err);
      }
    }

    // Create an order record
    const orderData = {
      listingId,
      buyerId,
      sellerId,
      status: 'awaiting_shipping', // Changed from 'completed' to 'awaiting_shipping'
      amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
      platformFee: session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0, // Convert from cents
      paymentSessionId: sessionId,
      paymentIntentId: paymentIntentId,
      trackingRequired: true, // Set tracking as required by default
      createdAt: new Date(),
      updatedAt: new Date(),
      // Include offer price if available
      ...(offerPrice && { offerPrice }),
      shippingAddress: session.shipping?.address ? {
        name: session.shipping.name,
        line1: session.shipping.address.line1,
        line2: session.shipping.address.line2,
        city: session.shipping.address.city,
        state: session.shipping.address.state,
        postal_code: session.shipping.address.postal_code,
        country: session.shipping.address.country,
      } : null,
      // Add the listing snapshot for display in the orders page
      listingSnapshot: {
        title: listingData.title || 'Untitled Listing',
        price: listingData.price || 0,
        imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null
      }
    };
    
    // Create the order in Firestore
    console.log('[Ensure Order Created] Creating order with data:', {
      listingId,
      buyerId,
      sellerId,
      amount: orderData.amount,
      paymentSessionId: sessionId
    });
    
    const orderRef = await firestoreDb.collection('orders').add(orderData);
    
    console.log('[Ensure Order Created] Order created successfully:', {
      orderId: orderRef.id,
      path: `orders/${orderRef.id}`
    });
    
    // Add the order to the buyer's orders
    await firestoreDb.collection('users').doc(buyerId).collection('orders').doc(orderRef.id).set({
      orderId: orderRef.id,
      role: 'buyer',
      createdAt: new Date()
    });
    
    // Add the order to the seller's orders
    await firestoreDb.collection('users').doc(sellerId).collection('orders').doc(orderRef.id).set({
      orderId: orderRef.id,
      role: 'seller',
      createdAt: new Date()
    });
    
    console.log('[Ensure Order Created] Order creation completed successfully:', {
      orderId: orderRef.id,
      listingId,
      buyerId,
      sellerId
    });
    
    return res.status(200).json({ 
      success: true,
      message: 'Order created successfully',
      orderId: orderRef.id
    });
  } catch (error) {
    console.error('[Ensure Order Created] Error processing request:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}