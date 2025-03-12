import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
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

// This is necessary to handle Stripe webhooks
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Stripe Webhook Fix] Request received:', {
    method: req.method,
    hasSignature: !!req.headers['stripe-signature'],
    url: req.url,
    headers: Object.keys(req.headers)
  });

  if (req.method !== 'POST') {
    console.log('[Stripe Webhook Fix] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhook Fix] Missing webhook secret');
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Webhook secret is not configured'
    });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[Stripe Webhook Fix] Missing Stripe signature');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Missing Stripe signature'
    });
  }

  let event: Stripe.Event;

  try {
    console.log('[Stripe Webhook Fix] Attempting to construct event with signature:', sig.substring(0, 10) + '...');
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('[Stripe Webhook Fix] Event constructed successfully:', {
      type: event.type,
      id: event.id,
      apiVersion: event.api_version
    });
  } catch (err) {
    console.error('[Stripe Webhook Fix] Error verifying webhook signature:', err);
    return res.status(400).json({
      error: 'Webhook verification failed',
      message: 'Could not verify webhook signature',
      details: err instanceof Error ? err.message : String(err)
    });
  }

  // Initialize Firebase Admin
  getFirebaseAdmin();
  const firestoreDb = getFirestore();

  try {
    // Only handle checkout.session.completed events for marketplace purchases
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only process marketplace purchases (those with listingId, buyerId, and sellerId)
      if (session.metadata?.listingId && session.metadata?.buyerId && session.metadata?.sellerId) {
        const { listingId, buyerId, sellerId } = session.metadata;
        
        console.log('[Stripe Webhook Fix] Marketplace purchase completed:', {
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
            console.log('[Stripe Webhook Fix] Order already exists for this session:', {
              orderId: existingOrder.id,
              paymentSessionId: session.id
            });
            
            return res.status(200).json({ 
              received: true,
              message: 'Order already exists',
              orderId: existingOrder.id
            });
          }

          // Get the payment intent to access transfer data
          let paymentIntentId = session.payment_intent as string;
          
          // Update the listing status to sold
          await firestoreDb.collection('listings').doc(listingId).update({
            status: 'sold',
            soldAt: new Date(),
            soldTo: buyerId,
            paymentSessionId: session.id,
            paymentIntentId: paymentIntentId,
            updatedAt: new Date()
          });
          
          console.log('[Stripe Webhook Fix] Listing marked as sold:', {
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
          console.log('[Stripe Webhook Fix] Creating order with data:', {
            listingId,
            buyerId,
            sellerId,
            amount: orderData.amount,
            paymentSessionId: session.id
          });
          
          const orderRef = await firestoreDb.collection('orders').add(orderData);
          
          console.log('[Stripe Webhook Fix] Order created successfully:', {
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
          
          console.log('[Stripe Webhook Fix] Order creation completed successfully:', {
            orderId: orderRef.id,
            listingId,
            buyerId,
            sellerId
          });
          
          return res.status(200).json({ 
            received: true,
            message: 'Order created successfully',
            orderId: orderRef.id
          });
        } catch (error) {
          console.error('[Stripe Webhook Fix] Error processing marketplace purchase:', error);
          throw error;
        }
      }
    }

    // For other event types, just acknowledge receipt
    return res.status(200).json({ 
      received: true,
      message: 'Event processed but no action taken',
      eventType: event.type
    });
  } catch (error) {
    console.error('[Stripe Webhook Fix] Error processing webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}