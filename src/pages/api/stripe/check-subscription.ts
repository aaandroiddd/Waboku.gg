import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // In preview environment, simulate premium status
    if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
      return res.status(200).json({ isPremium: true });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Here you would verify the Firebase ID token and get the user ID
    // For preview, we'll assume the token is valid
    const userId = 'preview-user';

    // Get customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: userId,
      status: 'active',
      limit: 1,
    });

    const isPremium = subscriptions.data.length > 0;

    return res.status(200).json({ isPremium });
  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}