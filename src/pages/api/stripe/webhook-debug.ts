import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
  console.log('[Stripe Webhook DEBUG] Request received:', {
    method: req.method,
    hasSignature: !!req.headers['stripe-signature'],
    url: req.url,
    headers: Object.keys(req.headers)
  });

  if (req.method !== 'POST') {
    console.log('[Stripe Webhook DEBUG] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhook DEBUG] Missing webhook secret');
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Webhook secret is not configured'
    });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[Stripe Webhook DEBUG] Missing Stripe signature');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Missing Stripe signature'
    });
  }

  let event: Stripe.Event;

  try {
    console.log('[Stripe Webhook DEBUG] Attempting to construct event with signature:', sig.substring(0, 10) + '...');
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('[Stripe Webhook DEBUG] Event constructed successfully:', {
      type: event.type,
      id: event.id,
      apiVersion: event.api_version
    });
  } catch (err) {
    console.error('[Stripe Webhook DEBUG] Error verifying webhook signature:', err);
    return res.status(400).json({
      error: 'Webhook verification failed',
      message: 'Could not verify webhook signature',
      details: err instanceof Error ? err.message : String(err)
    });
  }

  // Initialize Firebase Admin
  getFirebaseAdmin();
  const firestoreDb = getFirestore();
  const realtimeDb = getDatabase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        console.log('[Stripe Webhook DEBUG] Checkout session completed - full debugging:', {
          sessionId: session.id,
          metadata: session.metadata,
          hasShipping: !!session.shipping,
          shippingDetails: session.shipping ? {
            name: session.shipping.name,
            address: session.shipping.address
          } : null,
          customer_email: session.customer_email,
          amount_total: session.amount_total,
          mode: session.mode,
          payment_intent: session.payment_intent,
          payment_status: session.payment_status
        });
        
        // Handle subscription checkout
        if (session.metadata?.userId) {
          console.log('[Stripe Webhook DEBUG] This is a subscription checkout');
          return res.status(200).json({ received: true, type: 'subscription' });
        } 
        // Handle marketplace purchase
        else if (session.metadata?.listingId && session.metadata?.buyerId && session.metadata?.sellerId) {
          console.log('[Stripe Webhook DEBUG] This is a marketplace purchase');
          return res.status(200).json({ received: true, type: 'marketplace' });
        }
        // Catch-all for unhandled sessions
        else {
          console.log('[Stripe Webhook DEBUG] UNHANDLED checkout session:', {
            sessionId: session.id,
            metadata: session.metadata,
            hasShipping: !!session.shipping,
            customer_email: session.customer_email,
            amount_total: session.amount_total,
            mode: session.mode,
            metadataKeys: session.metadata ? Object.keys(session.metadata) : [],
            hasListingId: !!session.metadata?.listingId,
            hasBuyerId: !!session.metadata?.buyerId,
            hasSellerId: !!session.metadata?.sellerId,
            hasUserId: !!session.metadata?.userId
          });
          return res.status(200).json({ received: true, type: 'unhandled', metadata: session.metadata });
        }
        break;
      }

      default:
        console.log('[Stripe Webhook DEBUG] Unhandled event type:', event.type);
        return res.status(200).json({ received: true, type: 'other' });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook DEBUG] Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}