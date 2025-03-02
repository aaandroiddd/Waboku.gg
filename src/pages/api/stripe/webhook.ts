import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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
  console.log('[Stripe Webhook] Request received:', {
    method: req.method,
    hasSignature: !!req.headers['stripe-signature']
  });

  if (req.method !== 'POST') {
    console.log('[Stripe Webhook] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhook] Missing webhook secret');
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Webhook secret is not configured'
    });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[Stripe Webhook] Missing Stripe signature');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Missing Stripe signature'
    });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('[Stripe Webhook] Event constructed:', event.type);
  } catch (err) {
    console.error('[Stripe Webhook] Error verifying webhook signature:', err);
    return res.status(400).json({
      error: 'Webhook verification failed',
      message: 'Could not verify webhook signature'
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
        const userId = session.metadata?.userId;

        if (!userId) {
          throw new Error('No userId found in session metadata');
        }

        console.log('[Stripe Webhook] Checkout completed, updating user account:', {
          userId,
          sessionId: session.id
        });

        // Get current date for subscription dates
        const currentDate = new Date();
        const renewalDate = new Date(currentDate);
        renewalDate.setDate(currentDate.getDate() + 30); // 30 days from now

        // Update user's subscription status immediately after successful checkout in Realtime DB
        // Update tier and status separately to comply with validation rules
        await realtimeDb.ref(`users/${userId}/account/tier`).set('premium');
        await realtimeDb.ref(`users/${userId}/account/status`).set('active');
        
        // Update subscription fields separately
        const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
        await subscriptionRef.update({
          status: 'active', // Changed from 'processing' to 'active' for immediate effect
          tier: 'premium',
          startDate: currentDate.toISOString(),
          renewalDate: renewalDate.toISOString(),
          currentPeriodEnd: Math.floor(renewalDate.getTime() / 1000),
          lastUpdated: Date.now()
        });

        // Also update Firestore for consistency
        await firestoreDb.collection('users').doc(userId).set({
          accountTier: 'premium', // Top-level field for easier queries
          subscription: {
            currentPlan: 'premium',
            status: 'active',
            startDate: currentDate.toISOString(),
            endDate: renewalDate.toISOString() // Using endDate for consistency
          }
        }, { merge: true });

        console.log('[Stripe Webhook] User account updated to premium:', {
          userId,
          sessionId: session.id,
          startDate: currentDate.toISOString(),
          renewalDate: renewalDate.toISOString()
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          console.error('[Stripe Webhook] No userId found in subscription metadata:', {
            subscriptionId: subscription.id,
            metadata: subscription.metadata
          });
          throw new Error('No userId found in subscription metadata');
        }

        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();

        console.log('[Stripe Webhook] Processing subscription update:', {
          userId,
          subscriptionId: subscription.id,
          status,
          currentPeriodStart,
          currentPeriodEnd
        });

        // Update Firestore
        await firestoreDb.collection('users').doc(userId).set({
          accountTier: status === 'active' ? 'premium' : 'free', // Add accountTier at the top level
          subscription: {
            currentPlan: status === 'active' ? 'premium' : 'free',
            startDate: currentPeriodStart,
            endDate: currentPeriodEnd,
            status: status,
            stripeSubscriptionId: subscription.id // Add the subscription ID
          }
        }, { merge: true });

        // Update Realtime Database with more complete data - update fields separately
        const tier = status === 'active' ? 'premium' : 'free';
        
        // Update tier and status separately to comply with validation rules
        await realtimeDb.ref(`users/${userId}/account/tier`).set(tier);
        await realtimeDb.ref(`users/${userId}/account/status`).set('active');
        
        // Update subscription fields separately
        const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
        await subscriptionRef.update({
          stripeSubscriptionId: subscription.id,
          status: status,
          tier: tier,
          startDate: currentPeriodStart,
          endDate: currentPeriodEnd,
          renewalDate: currentPeriodEnd,
          currentPeriodEnd: subscription.current_period_end,
          lastUpdated: Date.now()
        });
        
        console.log('[Stripe Webhook] Updated subscription status:', {
          userId,
          subscriptionId: subscription.id,
          status: status,
          tier: status === 'active' ? 'premium' : 'free'
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          throw new Error('No userId found in subscription metadata');
        }

        const endDate = new Date(subscription.current_period_end * 1000).toISOString();

        // Update Firestore
        await firestoreDb.collection('users').doc(userId).set({
          subscription: {
            currentPlan: 'free',
            status: 'inactive',
            endDate: endDate
          }
        }, { merge: true });

        // Update Realtime Database - update fields separately
        await realtimeDb.ref(`users/${userId}/account/tier`).set('free');
        
        // Update subscription fields separately
        const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
        await subscriptionRef.update({
          status: 'inactive',
          tier: 'free',
          endDate: endDate,
          lastUpdated: Date.now()
        });
        
        console.log('[Stripe Webhook] Subscription deleted:', {
          userId,
          endDate: endDate
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        
        // Get the subscription to find the user ID
        const subDetails = await stripe.subscriptions.retrieve(subscription);
        const userId = subDetails.metadata.userId;

        if (!userId) {
          throw new Error('No userId found in subscription metadata');
        }

        // Update subscription status in database
        await realtimeDb.ref(`users/${userId}/account/subscription`).update({
          status: 'payment_failed',
          lastUpdated: Date.now()
        });

        console.log('[Stripe Webhook] Payment failed:', {
          userId,
          subscriptionId: subscription
        });
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}