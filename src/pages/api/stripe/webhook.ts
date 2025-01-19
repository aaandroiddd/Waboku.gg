import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Error verifying webhook signature:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Initialize Firebase Admin
  const { rtdb } = getFirebaseAdmin();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (subscription.status === 'active') {
          await rtdb.ref(`users/${userId}/account`).update({
            tier: 'premium',
            subscription: {
              status: 'active',
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
              startDate: new Date(subscription.current_period_start * 1000).toISOString(),
              renewalDate: new Date(subscription.current_period_end * 1000).toISOString(),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            }
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        await rtdb.ref(`users/${userId}/account`).update({
          tier: 'free',
          subscription: {
            status: 'none',
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            startDate: null,
            renewalDate: null,
            cancelAtPeriodEnd: false,
          }
        });
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}