import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Stripe
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
  console.log('[Admin Webhook Fix Trigger] Request received');

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('[Admin Webhook Fix Trigger] Invalid admin secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    // Retrieve the session from Stripe to get the necessary metadata
    console.log(`[Admin Webhook Fix Trigger] Retrieving session: ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if this is a marketplace purchase session
    if (!session.metadata?.listingId || !session.metadata?.buyerId || !session.metadata?.sellerId) {
      return res.status(400).json({ 
        error: 'Invalid session',
        message: 'This session does not appear to be a marketplace purchase (missing required metadata)',
        sessionMetadata: session.metadata || {}
      });
    }

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();

    // Process the session directly (similar to webhook-fix logic)
    const { listingId, buyerId, sellerId } = session.metadata;
    
    console.log('[Admin Webhook Fix Trigger] Processing marketplace purchase:', {
      listingId,
      buyerId,
      sellerId,
      sessionId: session.id
    });

    try {
      // First check if an order with this payment session already exists
      const existingOrdersQuery = await firestoreDb.collection('orders')
        .where('paymentSessionId', '==', session.id)
        .limit(1)
        .get();
      
      if (!existingOrdersQuery.empty) {
        const existingOrder = existingOrdersQuery.docs[0];
        console.log('[Admin Webhook Fix Trigger] Order already exists for this session:', {
          orderId: existingOrder.id,
          paymentSessionId: session.id
        });
        
        return res.status(200).json({ 
          success: true,
          message: 'Order already exists',
          orderId: existingOrder.id,
          orderData: existingOrder.data()
        });
      }

      // Get the payment intent ID
      let paymentIntentId = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent?.id;
      
      if (!paymentIntentId) {
        return res.status(400).json({
          error: 'Invalid session',
          message: 'No payment intent found for this session'
        });
      }

      // Update the listing status to sold
      await firestoreDb.collection('listings').doc(listingId).update({
        status: 'sold',
        soldAt: new Date(),
        soldTo: buyerId,
        paymentSessionId: session.id,
        paymentIntentId: paymentIntentId,
        updatedAt: new Date()
      });
      
      console.log('[Admin Webhook Fix Trigger] Listing marked as sold:', {
        listingId,
        status: 'sold',
        soldTo: buyerId
      });

      // Get the listing data to include in the order
      const listingDoc = await firestoreDb.collection('listings').doc(listingId).get();
      const listingData = listingDoc.data();
      
      if (!listingData) {
        throw new Error(`Listing ${listingId} not found`);
      }
      
      // Create an order record
      const orderData = {
        listingId,
        buyerId,
        sellerId,
        status: 'completed',
        amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
        platformFee: session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0, // Convert from cents
        paymentSessionId: session.id,
        paymentIntentId: paymentIntentId,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      console.log('[Admin Webhook Fix Trigger] Creating order with data:', {
        listingId,
        buyerId,
        sellerId,
        amount: orderData.amount,
        paymentSessionId: session.id
      });
      
      const orderRef = await firestoreDb.collection('orders').add(orderData);
      
      console.log('[Admin Webhook Fix Trigger] Order created successfully:', {
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
      
      console.log('[Admin Webhook Fix Trigger] Order creation completed successfully:', {
        orderId: orderRef.id,
        listingId,
        buyerId,
        sellerId
      });
      
      return res.status(200).json({ 
        success: true,
        message: 'Order created successfully',
        orderId: orderRef.id,
        sessionDetails: {
          id: session.id,
          metadata: session.metadata,
          amount_total: session.amount_total,
          payment_intent: paymentIntentId
        }
      });
    } catch (error) {
      console.error('[Admin Webhook Fix Trigger] Error processing marketplace purchase:', error);
      throw error;
    }
  } catch (error) {
    console.error('[Admin Webhook Fix Trigger] Error:', error);
    return res.status(500).json({
      error: 'Failed to trigger webhook fix',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}