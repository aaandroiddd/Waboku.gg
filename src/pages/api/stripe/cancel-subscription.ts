import { NextApiRequest, NextApiResponse } from 'next';
import { getApps, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';
import Stripe from 'stripe';

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

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

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
      userId
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
    const userRef = db.ref(`users/${userId}/account/subscription`);
    
    try {
      const userSnapshot = await userRef.get();
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

    // Cancel the subscription in Stripe
    try {
      console.log('Attempting to cancel Stripe subscription:', subscriptionId);
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      console.log('Stripe subscription canceled successfully:', subscription.id);

      // Calculate the end date from Stripe's response
      const endDate = new Date(subscription.current_period_end * 1000).toISOString();

      // Update subscription status in Firebase
      await userRef.update({
        status: 'canceled',
        endDate: endDate,
        stripeSubscriptionId: subscriptionId,
        canceledAt: new Date().toISOString()
      });

      console.log('Cancellation successful:', {
        userId,
        endDate
      });

      return res.status(200).json({ 
        success: true,
        message: 'Subscription canceled successfully',
        endDate
      });
    } catch (stripeError: any) {
      console.error('Stripe cancellation error:', {
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type
      });

      return res.status(400).json({
        error: 'Failed to cancel Stripe subscription',
        message: stripeError.message,
        code: stripeError.code || 'STRIPE_ERROR'
      });
    }

  } catch (error: any) {
    console.error('Subscription cancellation error:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message || 'Unknown error occurred',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}