import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getDatabase, ref, update, get } from 'firebase/database';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const isTestEnvironment = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'test';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
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
    console.log('Cancellation request received:', {
      subscriptionId,
      userId,
      isTestEnv: isTestEnvironment
    });

    // Validate required fields
    if (!subscriptionId) {
      console.error('Missing subscription ID');
      return res.status(400).json({ 
        error: 'Subscription ID is required',
        code: 'MISSING_SUBSCRIPTION_ID'
      });
    }

    if (!userId) {
      console.error('Missing user ID');
      return res.status(400).json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    // Use admin database instance for server operations
    const db = getAdminDatabase();
    const userRef = ref(db, `users/${userId}/account/subscription`);
    
    try {
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      if (!userData) {
        console.error('No subscription data found in Firebase:', { userId });
        return res.status(404).json({
          error: 'No subscription data found',
          code: 'NO_SUBSCRIPTION_DATA'
        });
      }

      if (userData.status === 'canceled') {
        console.log('Subscription already canceled:', { userId, subscriptionData: userData });
        return res.status(400).json({
          error: 'Subscription is already canceled',
          code: 'ALREADY_CANCELED'
        });
      }
    } catch (dbError) {
      console.error('Error accessing Firebase:', dbError);
      return res.status(500).json({
        error: 'Database error occurred',
        code: 'DATABASE_ERROR'
      });
    }

    if (isTestEnvironment) {
      console.log('Processing test environment cancellation');
      const now = new Date();
      const endDate = new Date(now.setDate(now.getDate() + 30));

      await update(ref(db, `users/${userId}/account`), {
        tier: 'free',
        subscription: {
          status: 'canceled',
          endDate: endDate.toISOString(),
          stripeSubscriptionId: subscriptionId
        }
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
    }

    // Production environment
    console.log('Processing production cancellation:', { subscriptionId });
    
    try {
      // Verify subscription exists in Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) {
        console.error('Subscription not found in Stripe:', { subscriptionId });
        return res.status(404).json({ 
          error: 'Subscription not found in Stripe',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      if (subscription.status === 'canceled') {
        console.log('Stripe subscription already canceled:', { subscriptionId });
        return res.status(400).json({
          error: 'Subscription is already canceled in Stripe',
          code: 'STRIPE_ALREADY_CANCELED'
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

      // Update Firebase with both subscription and tier changes
      await update(ref(db, `users/${userId}/account`), {
        tier: 'free',
        subscription: {
          status: 'canceled',
          endDate: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
          stripeSubscriptionId: subscriptionId
        }
      });

      console.log('Firebase update successful');

      return res.status(200).json({ 
        success: true,
        subscription: canceledSubscription,
        endDate: new Date(canceledSubscription.current_period_end * 1000).toISOString()
      });
    } catch (stripeError: any) {
      console.error('Stripe operation failed:', stripeError);
      return res.status(400).json({
        error: 'Stripe operation failed',
        message: stripeError.message,
        code: stripeError.code || 'STRIPE_ERROR'
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