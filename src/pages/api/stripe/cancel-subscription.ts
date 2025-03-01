import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';

// Initialize Stripe with more detailed configuration
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  maxNetworkRetries: 3,
  timeout: 20000,
});

// Allowed origins for CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the origin from the request headers
  const origin = req.headers.origin;

  // Set CORS headers based on the origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { subscriptionId, userId } = req.body;

    // Try to get userId from Authorization header if not provided in the request body
    if (!userId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split('Bearer ')[1];
        if (token) {
          // Verify the token and get the user ID
          getFirebaseAdmin(); // Initialize Firebase Admin
          const auth = getAuth();
          const decodedToken = await auth.verifyIdToken(token);
          userId = decodedToken.uid;
          console.log('Retrieved userId from token:', userId);
        }
      } catch (authError) {
        console.error('Error extracting user ID from token:', authError);
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Could not verify your identity. Please try again.',
          code: 'AUTH_ERROR'
        });
      }
    }

    // Check for preview environment
    const isPreview = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview';
    
    // Detailed request logging
    console.log('Cancellation request received:', {
      subscriptionId,
      userId,
      isPreview,
      timestamp: new Date().toISOString()
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
    getFirebaseAdmin(); // Ensure Firebase Admin is initialized
    const db = getDatabase();
    const userRef = db.ref(`users/${userId}/account/subscription`);
    
    try {
      // First verify the subscription exists in Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) {
        console.error('Subscription not found in Stripe:', subscriptionId);
        return res.status(404).json({
          error: 'Subscription not found in Stripe',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      if (subscription.status === 'canceled') {
        console.log('Subscription already canceled in Stripe:', subscriptionId);
        return res.status(400).json({
          error: 'Subscription is already canceled',
          code: 'ALREADY_CANCELED'
        });
      }

      // Cancel the subscription in Stripe
      console.log('Attempting to cancel Stripe subscription:', subscriptionId);
      const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      console.log('Stripe subscription updated successfully:', {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        cancelAt: canceledSubscription.cancel_at
      });

      // Calculate the end date from Stripe's response
      const endDate = new Date(canceledSubscription.current_period_end * 1000).toISOString();

      // Update subscription status in Firebase
      try {
        console.log('Attempting to update Firebase subscription data:', {
          userId,
          path: `users/${userId}/account/subscription`,
          status: 'canceling',
          endDate,
          stripeSubscriptionId: subscriptionId
        });
        
        // First check if the user exists in the database
        const userSnapshot = await db.ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
          console.error('User not found in database:', userId);
          return res.status(404).json({
            error: 'User not found in database',
            code: 'USER_NOT_FOUND'
          });
        }
        
        // Check if account path exists
        const accountSnapshot = await db.ref(`users/${userId}/account`).once('value');
        if (!accountSnapshot.exists()) {
          // Create account node if it doesn't exist
          await db.ref(`users/${userId}/account`).set({
            tier: 'free',
            lastUpdated: Date.now()
          });
        }
        
        // Check if subscription data exists
        const subscriptionSnapshot = await db.ref(`users/${userId}/account/subscription`).once('value');
        const subscriptionData = subscriptionSnapshot.exists() ? subscriptionSnapshot.val() : {};
        
        // Prepare complete subscription data to ensure all required fields are present
        const updatedSubscription = {
          // Keep existing data
          ...subscriptionData,
          // Update with new cancellation data
          status: 'canceled',
          endDate: endDate,
          renewalDate: endDate, // Set renewal date to end date for canceled subscriptions
          stripeSubscriptionId: subscriptionId,
          canceledAt: new Date().toISOString(),
          cancelAtPeriodEnd: true
        };
        
        // Set the entire subscription object to ensure all required fields are present
        await db.ref(`users/${userId}/account/subscription`).set(updatedSubscription);
        
        console.log('Firebase subscription data updated successfully');
      } catch (dbError: any) {
        console.error('Firebase database update error:', {
          error: dbError.message,
          code: dbError.code,
          userId,
          path: `users/${userId}/account/subscription`
        });
        
        // Try an alternative approach if the first update fails
        try {
          console.log('Attempting alternative database update approach');
          
          // Try updating the account tier directly
          await db.ref(`users/${userId}/account`).update({
            tier: 'premium', // Keep as premium until end date
            lastUpdated: Date.now()
          });
          
          // Try setting minimal subscription data
          await db.ref(`users/${userId}/account/subscription`).set({
            status: 'canceled',
            endDate: endDate,
            renewalDate: endDate, // Set renewal date to end date
            stripeSubscriptionId: subscriptionId,
            canceledAt: new Date().toISOString(),
            cancelAtPeriodEnd: true
          });
          
          console.log('Alternative database update successful');
        } catch (altError: any) {
          console.error('Alternative database update also failed:', {
            error: altError.message,
            code: altError.code
          });
          
          // If we can't update the database but the Stripe cancellation was successful,
          // we should still return a success response but note the database error
          return res.status(200).json({ 
            success: true,
            message: 'Subscription canceled in Stripe but database update failed. Please refresh the page.',
            endDate,
            status: 'canceling',
            databaseError: dbError.message
          });
        }
      }

      console.log('Cancellation process completed successfully:', {
        userId,
        subscriptionId,
        endDate
      });

      return res.status(200).json({ 
        success: true,
        message: 'Subscription will be canceled at the end of the billing period',
        endDate,
        status: 'canceled'
      });

    } catch (stripeError: any) {
      console.error('Stripe operation error:', {
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type,
        requestId: stripeError.requestId
      });

      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          error: 'Invalid subscription details',
          message: stripeError.message,
          code: 'INVALID_SUBSCRIPTION'
        });
      }

      return res.status(500).json({
        error: 'Failed to process subscription cancellation',
        message: stripeError.message,
        code: stripeError.code || 'STRIPE_ERROR'
      });
    }

  } catch (error: any) {
    console.error('Subscription cancellation error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message || 'Unknown error occurred',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
}