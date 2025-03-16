import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getSubscriptionData, syncSubscriptionData } from '@/lib/subscription-sync';
import Stripe from 'stripe';

// Initialize Stripe with error handling
const initializeStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[Subscription Check] Missing STRIPE_SECRET_KEY');
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      maxNetworkRetries: 3,
      timeout: 20000
    });
    console.log('[Subscription Check] Stripe initialized successfully');
    return stripe;
  } catch (error: any) {
    console.error('[Subscription Check] Failed to initialize Stripe:', {
      error: error.message,
      type: error.type,
      code: error.code
    });
    throw error;
  }
};

// Initialize Stripe outside the handler for better performance
let stripe: Stripe;
try {
  stripe = initializeStripe();
} catch (error) {
  console.error('[Subscription Check] Stripe initialization failed at module level');
  // We'll try again in the handler
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Subscription Check ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Add caching headers to reduce frequent calls
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300'); // Cache for 5 minutes
  res.setHeader('Surrogate-Control', 'max-age=300'); // Cache for CDN
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    console.warn(`[Subscription Check ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize Stripe if not already initialized
  if (!stripe) {
    try {
      stripe = initializeStripe();
    } catch (error: any) {
      console.error(`[Subscription Check ${requestId}] Failed to initialize Stripe:`, error.message);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: 'Payment service unavailable',
        code: 'STRIPE_INIT_FAILED'
      });
    }
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Subscription Check ${requestId}] Missing or invalid authorization header`);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Missing or invalid authorization token',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Initialize Firebase Admin and verify token
      const admin = getFirebaseAdmin();
      console.log(`[Subscription Check ${requestId}] Firebase Admin initialized successfully`);
      
      // Log token details for debugging (safely)
      console.log(`[Subscription Check ${requestId}] Verifying token:`, {
        tokenLength: idToken.length,
        tokenPrefix: idToken.substring(0, 5) + '...',
        tokenSuffix: '...' + idToken.slice(-5),
        timestamp: new Date().toISOString()
      });
      
      // Verify the token and get user data
      let decodedToken;
      try {
        // The correct way to access the auth() method
        decodedToken = await admin.auth().verifyIdToken(idToken, true);
      } catch (error: any) {
        console.error(`[Subscription Check ${requestId}] Token verification failed:`, {
          error: error.message,
          code: error.code,
          type: error.type,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        // Try one more time without forcing token refresh
        try {
          console.log(`[Subscription Check ${requestId}] Retrying token verification without refresh check`);
          decodedToken = await admin.auth().verifyIdToken(idToken, false);
          console.log(`[Subscription Check ${requestId}] Retry succeeded`);
        } catch (retryError: any) {
          console.error(`[Subscription Check ${requestId}] Retry token verification also failed:`, {
            error: retryError.message,
            code: retryError.code
          });
          throw retryError;
        }
      }
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Subscription Check ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified,
        tokenIssued: new Date(decodedToken.iat * 1000).toISOString(),
        tokenExpires: new Date(decodedToken.exp * 1000).toISOString()
      });

      // Get subscription data using our utility function
      const { source, data: subscriptionData } = await getSubscriptionData(userId);
      
      console.log(`[Subscription Check ${requestId}] Retrieved subscription data from ${source}:`, {
        userId,
        accountTier: subscriptionData.accountTier,
        status: subscriptionData.status,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId ? 'exists' : 'missing'
      });

      // If admin has set premium status, ensure it's properly synced
      if (subscriptionData.accountTier === 'premium' && 
          (subscriptionData.manuallyUpdated || 
           (subscriptionData.stripeSubscriptionId && subscriptionData.stripeSubscriptionId.includes('admin_')))) {
        
        console.log(`[Subscription Check ${requestId}] Using admin-set premium status:`, {
          accountTier: subscriptionData.accountTier,
          subscriptionPlan: subscriptionData.currentPlan,
          subscriptionStatus: subscriptionData.status,
          manuallyUpdated: subscriptionData.manuallyUpdated
        });
        
        // Ensure admin subscription has proper dates
        const currentDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(currentDate.getFullYear() + 1); // Set end date to 1 year from now
        
        const updatedSubscription = {
          ...subscriptionData,
          tier: 'premium',
          currentPlan: 'premium',
          status: 'active',
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId || `admin_${userId}_${Date.now()}`,
          currentPeriodEnd: Math.floor(endDate.getTime() / 1000),
          startDate: subscriptionData.startDate || currentDate.toISOString(),
          renewalDate: endDate.toISOString(),
          manuallyUpdated: true
        };
        
        // Sync the updated data to both databases
        await syncSubscriptionData(userId, updatedSubscription);
        
        return res.status(200).json({
          isPremium: true,
          status: 'active',
          tier: 'premium',
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          renewalDate: updatedSubscription.renewalDate,
          startDate: updatedSubscription.startDate,
          subscriptionId: updatedSubscription.stripeSubscriptionId
        });
      }

      // If no subscription or free tier, return that info
      if (!subscriptionData.stripeSubscriptionId || subscriptionData.status === 'none') {
        console.log(`[Subscription Check ${requestId}] No active subscription found:`, { userId });
        return res.status(200).json({ 
          isPremium: false,
          status: 'none',
          tier: 'free'
        });
      }

      // If there's a Stripe subscription ID, verify with Stripe
      let stripeSubscription = null;
      if (subscriptionData.stripeSubscriptionId && !subscriptionData.stripeSubscriptionId.includes('admin_')) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);
          
          // Update subscription status from Stripe
          const updatedSubscription = {
            ...subscriptionData,
            status: stripeSubscription.status,
            currentPeriodEnd: stripeSubscription.current_period_end,
            renewalDate: new Date(stripeSubscription.current_period_end * 1000).toISOString()
          };
          
          // Sync the updated data to both databases
          await syncSubscriptionData(userId, updatedSubscription);

          console.log(`[Subscription Check ${requestId}] Updated subscription with Stripe data:`, {
            userId,
            status: stripeSubscription.status,
            currentPeriodEnd: stripeSubscription.current_period_end
          });
          
          // Update local reference for response
          subscriptionData.status = stripeSubscription.status;
          subscriptionData.currentPeriodEnd = stripeSubscription.current_period_end;
          subscriptionData.renewalDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
          
        } catch (stripeError: any) {
          console.error(`[Subscription Check ${requestId}] Stripe error:`, {
            code: stripeError.code,
            message: stripeError.message,
            type: stripeError.type
          });
          
          // If Stripe subscription not found, reset status
          if (stripeError.code === 'resource_missing') {
            const resetSubscription = {
              ...subscriptionData,
              status: 'none',
              stripeSubscriptionId: null
            };
            
            // Sync the reset data to both databases
            await syncSubscriptionData(userId, resetSubscription);
            
            // Update local reference for response
            subscriptionData.status = 'none';
            subscriptionData.stripeSubscriptionId = null;
          }
        }
      }
      
      const now = Date.now() / 1000;
      const isActive = (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') && 
                      subscriptionData.currentPeriodEnd && 
                      subscriptionData.currentPeriodEnd > now;

      console.log(`[Subscription Check ${requestId}] Final status:`, {
        userId,
        isActive,
        subscription: {
          status: subscriptionData.status,
          tier: subscriptionData.accountTier || subscriptionData.currentPlan,
          currentPeriodEnd: subscriptionData.currentPeriodEnd
        }
      });

      // Check if this is an admin-assigned subscription
      const isAdminAssigned = subscriptionData.stripeSubscriptionId?.includes('admin_');
      
      // For admin-assigned subscriptions, ensure we have a renewal date
      if (isAdminAssigned && (!subscriptionData.renewalDate || !subscriptionData.startDate)) {
        const currentDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(currentDate.getFullYear() + 1); // Set end date to 1 year from now
        
        const updatedSubscription = {
          ...subscriptionData,
          startDate: subscriptionData.startDate || currentDate.toISOString(),
          renewalDate: endDate.toISOString(),
        };
        
        // Sync the updated data to both databases
        await syncSubscriptionData(userId, updatedSubscription);
        
        // Update local reference for response
        subscriptionData.startDate = updatedSubscription.startDate;
        subscriptionData.renewalDate = updatedSubscription.renewalDate;
      }
      
      return res.status(200).json({
        isPremium: isActive && (subscriptionData.accountTier === 'premium' || subscriptionData.currentPlan === 'premium'),
        status: subscriptionData.status || 'none',
        tier: subscriptionData.accountTier || subscriptionData.currentPlan || 'free',
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        renewalDate: subscriptionData.renewalDate,
        startDate: subscriptionData.startDate,
        subscriptionId: subscriptionData.stripeSubscriptionId
      });

    } catch (authError: any) {
      console.error(`[Subscription Check ${requestId}] Auth error:`, {
        code: authError.code,
        message: authError.message,
        stack: authError.stack
      });
      
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: authError.message || 'Invalid authentication token',
        code: authError.code || 'AUTH_TOKEN_INVALID'
      });
    }

  } catch (error: any) {
    console.error(`[Subscription Check ${requestId}] Unhandled error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check subscription status',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}