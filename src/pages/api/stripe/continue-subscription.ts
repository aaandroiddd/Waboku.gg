import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { syncSubscriptionData, getSubscriptionData } from '@/lib/subscription-sync';
import { subscriptionHistoryService } from '@/lib/subscription-history-service';
import { subscriptionHistoryCache } from '@/lib/subscription-history-cache';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  maxNetworkRetries: 3,
  timeout: 20000,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(`[Continue Subscription ${requestId}] Request received`);

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Initialize Firebase Admin and verify token
    getFirebaseAdmin();
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log(`[Continue Subscription ${requestId}] User authenticated:`, userId);

    // Get current subscription data
    const { source, data: subscriptionData } = await getSubscriptionData(userId);
    
    console.log(`[Continue Subscription ${requestId}] Retrieved subscription data from ${source}:`, {
      userId,
      accountTier: subscriptionData.accountTier,
      status: subscriptionData.status,
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId ? 'exists' : 'missing',
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd
    });

    // Check if subscription is canceled and can be continued
    if (subscriptionData.status !== 'canceled' && !subscriptionData.cancelAtPeriodEnd) {
      return res.status(400).json({ 
        error: 'No canceled subscription found to continue',
        currentStatus: subscriptionData.status
      });
    }

    const stripeSubscriptionId = subscriptionData.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      return res.status(400).json({ error: 'No Stripe subscription ID found' });
    }

    // Handle admin subscriptions differently
    if (stripeSubscriptionId.includes('admin_')) {
      console.log(`[Continue Subscription ${requestId}] Continuing admin subscription:`, stripeSubscriptionId);
      
      // For admin subscriptions, just remove the cancellation flag
      const updatedSubscription = {
        ...subscriptionData,
        status: 'active',
        cancelAtPeriodEnd: false,
        canceledAt: null,
        // Keep existing dates
        tier: 'premium',
        currentPlan: 'premium'
      };
      
      // Sync the updated data
      await syncSubscriptionData(userId, updatedSubscription);
      
      // Add subscription continued event to history
      try {
        await subscriptionHistoryService.addSubscriptionContinued(
          userId, 
          stripeSubscriptionId,
          updatedSubscription.renewalDate || updatedSubscription.endDate
        );
        console.log(`[Continue Subscription ${requestId}] Added continuation event to history`);
      } catch (historyError) {
        console.error(`[Continue Subscription ${requestId}] Failed to add history event:`, historyError);
        // Don't fail the request if history update fails
      }
      
      // Invalidate subscription history cache so user sees updated history immediately
      try {
        subscriptionHistoryCache.invalidate(userId);
        console.log(`[Continue Subscription ${requestId}] Invalidated subscription history cache`);
      } catch (cacheError) {
        console.error(`[Continue Subscription ${requestId}] Failed to invalidate cache:`, cacheError);
        // Don't fail the request if cache invalidation fails
      }
      
      return res.status(200).json({
        success: true,
        subscriptionId: stripeSubscriptionId,
        status: 'active',
        message: 'Admin subscription continued successfully',
      });
    }

    // For regular Stripe subscriptions, remove the cancellation
    try {
      console.log(`[Continue Subscription ${requestId}] Continuing Stripe subscription:`, stripeSubscriptionId);
      
      // First, check the current subscription status in Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      if (stripeSubscription.status === 'canceled') {
        return res.status(400).json({ 
          error: 'Subscription is already fully canceled in Stripe and cannot be continued. Please create a new subscription.' 
        });
      }

      // If the subscription is set to cancel at period end, remove that flag
      if (stripeSubscription.cancel_at_period_end) {
        console.log(`[Continue Subscription ${requestId}] Removing cancel_at_period_end flag`);
        
        const updatedStripeSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: false
        });

        console.log(`[Continue Subscription ${requestId}] Stripe subscription updated:`, {
          id: updatedStripeSubscription.id,
          status: updatedStripeSubscription.status,
          cancel_at_period_end: updatedStripeSubscription.cancel_at_period_end
        });

        // Update our database
        const updatedSubscription = {
          ...subscriptionData,
          status: updatedStripeSubscription.status,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          renewalDate: new Date(updatedStripeSubscription.current_period_end * 1000).toISOString(),
          tier: 'premium',
          currentPlan: 'premium'
        };
        
        // Sync the updated data
        await syncSubscriptionData(userId, updatedSubscription);

        // Add subscription continued event to history
        try {
          await subscriptionHistoryService.addSubscriptionContinued(
            userId, 
            stripeSubscriptionId,
            new Date(updatedStripeSubscription.current_period_end * 1000).toISOString()
          );
          console.log(`[Continue Subscription ${requestId}] Added continuation event to history`);
        } catch (historyError) {
          console.error(`[Continue Subscription ${requestId}] Failed to add history event:`, historyError);
          // Don't fail the request if history update fails
        }

        // Invalidate subscription history cache so user sees updated history immediately
        try {
          subscriptionHistoryCache.invalidate(userId);
          console.log(`[Continue Subscription ${requestId}] Invalidated subscription history cache`);
        } catch (cacheError) {
          console.error(`[Continue Subscription ${requestId}] Failed to invalidate cache:`, cacheError);
          // Don't fail the request if cache invalidation fails
        }

        console.log(`[Continue Subscription ${requestId}] Subscription continued successfully:`, {
          userId,
          subscriptionId: stripeSubscriptionId,
          status: updatedStripeSubscription.status
        });

        return res.status(200).json({
          success: true,
          subscriptionId: stripeSubscriptionId,
          status: updatedStripeSubscription.status,
          currentPeriodEnd: updatedStripeSubscription.current_period_end,
          message: 'Subscription continued successfully',
        });
      } else {
        return res.status(400).json({ 
          error: 'Subscription is not set to cancel and does not need to be continued',
          currentStatus: stripeSubscription.status
        });
      }

    } catch (stripeError: any) {
      console.error(`[Continue Subscription ${requestId}] Stripe error:`, {
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type
      });

      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          error: 'Invalid subscription details',
          message: stripeError.message,
        });
      }

      return res.status(500).json({
        error: 'Failed to continue subscription with Stripe',
        message: stripeError.message,
      });
    }

  } catch (error: any) {
    console.error(`[Continue Subscription ${requestId}] Error:`, {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: 'Failed to continue subscription',
      message: error.message || 'Unknown error occurred'
    });
  }
}