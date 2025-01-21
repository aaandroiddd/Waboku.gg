import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getDatabase } from 'firebase-admin/database';
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
  initAdmin();
  const db = getDatabase();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (subscription.status === 'active') {
          await db.ref(`users/${userId}/account`).update({
            tier: 'premium',
            status: 'active',
            stripeCustomerId: subscription.customer as string,
            subscriptionId: subscription.id
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        await db.ref(`users/${userId}/account`).update({
          tier: 'free',
          status: 'active',
          stripeCustomerId: null,
          subscriptionId: null
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