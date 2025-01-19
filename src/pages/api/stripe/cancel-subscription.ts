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

    // Detailed request logging
    console.log('Cancellation request details:', {
      subscriptionId,
      userId,
      headers: req.headers,
      isTestEnv: isTestEnvironment,
      body: JSON.stringify(req.body)
    });

    // Validate required fields
    if (!subscriptionId) {
      console.error('Missing subscription ID:', { body: req.body });
      return res.status(400).json({ 
        error: 'Subscription ID is required',
        code: 'MISSING_SUBSCRIPTION_ID'
      });
    }

    if (!userId) {
      console.error('Missing user ID:', { body: req.body });
      return res.status(400).json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    const db = getDatabase();

    if (isTestEnvironment) {
      console.log('Processing test environment cancellation');
      const now = new Date();
      const endDate = new Date(now.setDate(now.getDate() + 30));

      await update(ref(db, `users/${userId}/account/subscription`), {
        status: 'canceled',
        endDate: endDate.toISOString(),
      });

      console.log('Test cancellation successful:', {
        userId,
        endDate: endDate.toISOString()
      });

      return res.status(200).json({ 
        success: true,
        message: 'Subscription canceled in test environment',
        endDate: endDate.toISOString()
      });
    } else {
      console.log('Processing production cancellation:', { subscriptionId });
      
      // Verify subscription exists in Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) {
        console.error('Subscription not found in Stripe:', { subscriptionId });
        return res.status(404).json({ 
          error: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      // Cancel the subscription
      const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      console.log('Stripe cancellation successful:', {
        subscriptionId,
        endDate: new Date(canceledSubscription.current_period_end * 1000)
      });

      // Update Firebase
      await update(ref(db, `users/${userId}/account/subscription`), {
        status: 'canceled',
        endDate: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
      });

      console.log('Firebase update successful');

      return res.status(200).json({ 
        success: true,
        subscription: canceledSubscription,
        endDate: new Date(canceledSubscription.current_period_end * 1000).toISOString()
      });
    }
  } catch (error: any) {
    console.error('Subscription cancellation error:', {
      error: error.message,
      stack: error.stack,
      type: error.type,
      code: error.code
    });

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({
        error: 'Stripe error occurred',
        message: error.message,
        code: error.code
      });
    }

    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message || 'Unknown error occurred',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}