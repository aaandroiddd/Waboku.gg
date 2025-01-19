import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getDatabase, ref, update } from 'firebase/database';
import { initializeApp } from 'firebase/app';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const isTestEnvironment = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'test';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptionId, userId } = req.body;

    if (!subscriptionId || !userId) {
      return res.status(400).json({ error: 'Subscription ID and User ID are required' });
    }

    if (isTestEnvironment) {
      // In test environment, directly update Firebase
      const db = getDatabase();
      const now = new Date();
      const endDate = new Date(now.setDate(now.getDate() + 30)); // Set end date to 30 days from now

      await update(ref(db, `users/${userId}/account/subscription`), {
        status: 'canceled',
        endDate: endDate.toISOString(),
      });

      return res.status(200).json({ 
        success: true,
        message: 'Subscription canceled in test environment',
        endDate: endDate.toISOString()
      });
    } else {
      // Production environment - use Stripe
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      return res.status(200).json({ subscription });
    }
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}