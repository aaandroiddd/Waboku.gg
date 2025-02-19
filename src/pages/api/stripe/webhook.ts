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
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          throw new Error('No userId found in subscription metadata');
        }

        if (subscription.status === 'active') {
          // Update Firestore
          await firestoreDb.collection('users').doc(userId).set({
            subscription: {
              currentPlan: 'premium',
              startDate: new Date(subscription.current_period_start * 1000).toISOString(),
              status: 'active'
            }
          }, { merge: true });

          // Update Realtime Database
          await realtimeDb.ref(`users/${userId}/account`).update({
            status: 'active',
            subscription: {
              id: subscription.id,
              status: 'active',
              tier: 'premium',
              currentPeriodEnd: subscription.current_period_end
            }
          });
          
          console.log('[Stripe Webhook] Updated user subscription status:', {
            userId,
            subscriptionId: subscription.id,
            status: 'active',
            tier: 'premium'
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          throw new Error('No userId found in subscription metadata');
        }

        // Update Firestore
        await firestoreDb.collection('users').doc(userId).set({
          subscription: {
            currentPlan: 'free',
            status: 'inactive'
          }
        }, { merge: true });

        // Update Realtime Database
        await realtimeDb.ref(`users/${userId}/account`).update({
          status: 'active',
          subscription: {
            status: 'inactive',
            tier: 'free'
          }
        });
        
        console.log('[Stripe Webhook] Reset user subscription:', {
          userId,
          status: 'inactive',
          tier: 'free'
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