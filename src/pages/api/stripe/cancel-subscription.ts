import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { syncSubscriptionData, getSubscriptionData } from '@/lib/subscription-sync';
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
  const requestId = Math.random().toString(36).substring(7);
  
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
          console.log(`[Cancel Subscription ${requestId}] Retrieved userId from token:`, userId);
        }
      } catch (authError) {
        console.error(`[Cancel Subscription ${requestId}] Error extracting user ID from token:`, authError);
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
    console.log(`[Cancel Subscription ${requestId}] Cancellation request received:`, {
      subscriptionId,
      userId,
      isPreview,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!subscriptionId) {
      console.error(`[Cancel Subscription ${requestId}] Missing subscription ID`);
      return res.status(400).json({ 
        error: 'Subscription ID is required',
        code: 'MISSING_SUBSCRIPTION_ID'
      });
    }

    if (!userId) {
      console.error(`[Cancel Subscription ${requestId}] Missing user ID`);
      return res.status(400).json({ 
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    // Get current subscription data
    const { source, data: subscriptionData } = await getSubscriptionData(userId);
    
    console.log(`[Cancel Subscription ${requestId}] Retrieved subscription data from ${source}:`, {
      userId,
      accountTier: subscriptionData.accountTier,
      status: subscriptionData.status,
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId ? 'exists' : 'missing'
    });
    
    // Verify the subscription ID matches
    if (subscriptionData.stripeSubscriptionId !== subscriptionId) {
      console.error(`[Cancel Subscription ${requestId}] Subscription ID mismatch:`, {
        providedId: subscriptionId,
        storedId: subscriptionData.stripeSubscriptionId
      });
      
      // If we have a stored ID but it doesn't match, use the stored one
      if (subscriptionData.stripeSubscriptionId) {
        console.log(`[Cancel Subscription ${requestId}] Using stored subscription ID instead:`, subscriptionData.stripeSubscriptionId);
        subscriptionId = subscriptionData.stripeSubscriptionId;
      }
    }
    
    try {
      // For admin-assigned subscriptions, handle differently
      if (subscriptionId.includes('admin_') || !subscriptionId.startsWith('sub_')) {
        console.log(`[Cancel Subscription ${requestId}] Canceling admin-assigned or non-standard subscription:`, subscriptionId);
        
        // Calculate the end date (30 days from now)
        const currentDate = new Date();
        const endDate = new Date();
        endDate.setDate(currentDate.getDate() + 30);
        
        // Update subscription data
        const updatedSubscription = {
          ...subscriptionData,
          status: 'canceled',
          endDate: endDate.toISOString(),
          renewalDate: endDate.toISOString(),
          canceledAt: currentDate.toISOString(),
          cancelAtPeriodEnd: true
        };
        
        // Sync the updated data to both databases
        await syncSubscriptionData(userId, updatedSubscription);
        
        console.log(`[Cancel Subscription ${requestId}] Non-standard subscription canceled successfully:`, {
          userId,
          subscriptionId,
          endDate: endDate.toISOString()
        });
        
        return res.status(200).json({
          success: true,
          message: 'Subscription will be canceled at the end of the period',
          endDate: endDate.toISOString(),
          status: 'canceled'
        });
      }
      
      // For regular Stripe subscriptions, cancel through Stripe
      // First verify the subscription exists in Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) {
        console.error(`[Cancel Subscription ${requestId}] Subscription not found in Stripe:`, subscriptionId);
        return res.status(404).json({
          error: 'Subscription not found in Stripe',
          code: 'SUBSCRIPTION_NOT_FOUND'
        });
      }

      if (subscription.status === 'canceled') {
        console.log(`[Cancel Subscription ${requestId}] Subscription already canceled in Stripe:`, subscriptionId);
        
        // Update our database to reflect this
        const endDate = new Date(subscription.current_period_end * 1000).toISOString();
        const updatedSubscription = {
          ...subscriptionData,
          status: 'canceled',
          endDate: endDate,
          renewalDate: endDate,
          canceledAt: new Date().toISOString(),
          cancelAtPeriodEnd: true
        };
        
        // Sync the updated data to both databases
        await syncSubscriptionData(userId, updatedSubscription);
        
        return res.status(400).json({
          error: 'Subscription is already canceled',
          code: 'ALREADY_CANCELED',
          endDate: endDate
        });
      }

      // Cancel the subscription in Stripe
      console.log(`[Cancel Subscription ${requestId}] Attempting to cancel Stripe subscription:`, subscriptionId);
      const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      console.log(`[Cancel Subscription ${requestId}] Stripe subscription updated successfully:`, {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        cancelAt: canceledSubscription.cancel_at
      });

      // Calculate the end date from Stripe's response
      const endDate = new Date(canceledSubscription.current_period_end * 1000).toISOString();

      // Update subscription data
      const updatedSubscription = {
        ...subscriptionData,
        status: 'canceled',
        endDate: endDate,
        renewalDate: endDate,
        stripeSubscriptionId: subscriptionId,
        canceledAt: new Date().toISOString(),
        cancelAtPeriodEnd: true
      };
      
      // Sync the updated data to both databases
      const syncResult = await syncSubscriptionData(userId, updatedSubscription);
      
      if (!syncResult.success) {
        console.error(`[Cancel Subscription ${requestId}] Database sync failed:`, syncResult.error);
        
        // If we can't update the database but the Stripe cancellation was successful,
        // we should still return a success response but note the database error
        return res.status(200).json({ 
          success: true,
          message: 'Subscription canceled in Stripe but database update failed. Please refresh the page.',
          endDate,
          status: 'canceled',
          databaseError: syncResult.error
        });
      }

      console.log(`[Cancel Subscription ${requestId}] Cancellation process completed successfully:`, {
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
      console.error(`[Cancel Subscription ${requestId}] Stripe operation error:`, {
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type,
        requestId: stripeError.requestId
      });

      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        // If the subscription doesn't exist in Stripe but we have it in our database,
        // update our database to reflect that it's canceled
        if (stripeError.code === 'resource_missing' && subscriptionData.stripeSubscriptionId) {
          console.log(`[Cancel Subscription ${requestId}] Subscription not found in Stripe, updating database:`, subscriptionId);
          
          const currentDate = new Date();
          const endDate = new Date();
          endDate.setDate(currentDate.getDate() + 30);
          
          const updatedSubscription = {
            ...subscriptionData,
            status: 'canceled',
            endDate: endDate.toISOString(),
            renewalDate: endDate.toISOString(),
            canceledAt: currentDate.toISOString(),
            cancelAtPeriodEnd: true
          };
          
          // Sync the updated data to both databases
          await syncSubscriptionData(userId, updatedSubscription);
          
          return res.status(200).json({
            success: true,
            message: 'Subscription not found in Stripe but marked as canceled in our system',
            endDate: endDate.toISOString(),
            status: 'canceled'
          });
        }
        
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