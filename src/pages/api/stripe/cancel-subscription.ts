import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getDatabase, ref, update } from 'firebase/database';
import { initializeApp, getApps } from 'firebase/app';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const isTestEnvironment = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'test';

// Initialize Firebase if it hasn't been initialized yet
if (!getApps().length) {
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptionId, userId } = req.body;

    console.log('Received request body:', req.body);
    
    console.log('Received cancellation request:', {
      subscriptionId,
      userId,
      body: req.body,
      headers: req.headers,
      isTestEnv: isTestEnvironment
    });

    if (!subscriptionId || !userId) {
      console.error('Missing required fields:', { 
        hasSubscriptionId: !!subscriptionId, 
        hasUserId: !!userId,
        subscriptionIdValue: subscriptionId,
        userIdValue: userId,
        body: req.body 
      });
      return res.status(400).json({ 
        error: 'Subscription ID and User ID are required',
        receivedSubscriptionId: subscriptionId ? 'yes' : 'no',
        receivedUserId: userId ? 'yes' : 'no',
        debug: { 
          body: req.body,
          subscriptionId,
          userId
        }
      });
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

      // Update Firebase with the cancellation status
      const db = getDatabase();
      await update(ref(db, `users/${userId}/account/subscription`), {
        status: 'canceled',
        endDate: new Date(subscription.current_period_end * 1000).toISOString(),
      });

      return res.status(200).json({ 
        success: true,
        subscription,
        endDate: new Date(subscription.current_period_end * 1000).toISOString()
      });
    }
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message || 'Unknown error occurred'
    });
  }
}