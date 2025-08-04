import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('Missing NEXT_PUBLIC_APP_URL');
}

if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
  throw new Error('Missing STRIPE_PREMIUM_PRICE_ID');
}

let stripe: Stripe;
try {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
  console.log('[Create Delayed Checkout] Stripe initialized successfully');
} catch (error: any) {
  console.error('[Create Delayed Checkout] Failed to initialize Stripe:', {
    error: error.message,
    type: error.type,
    code: error.code
  });
  throw error;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Create Delayed Checkout ${requestId}] Started:`, {
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'POST') {
    console.warn(`[Create Delayed Checkout ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Create Delayed Checkout ${requestId}] Missing or invalid authorization header`);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Missing or invalid authorization token',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    const { startDate } = req.body; // Expected to be ISO string of when subscription should start
    
    try {
      // Initialize Firebase Admin
      const { admin: firebaseAdmin, auth } = getFirebaseAdmin();
      console.log(`[Create Delayed Checkout ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      const decodedToken = await auth.verifyIdToken(idToken, true);
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Create Delayed Checkout ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        requestedStartDate: startDate
      });

      if (!userEmail) {
        console.error('[Create Delayed Checkout] No user email found for user:', userId);
        return res.status(400).json({ 
          error: 'Missing email',
          message: 'User email is required for subscription',
          code: 'EMAIL_MISSING'
        });
      }

      if (!startDate) {
        console.error('[Create Delayed Checkout] No start date provided');
        return res.status(400).json({ 
          error: 'Missing start date',
          message: 'Start date is required for delayed subscription',
          code: 'START_DATE_MISSING'
        });
      }

      // Validate start date is in the future
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const nowTimestamp = Math.floor(Date.now() / 1000);
      
      if (startTimestamp <= nowTimestamp) {
        return res.status(400).json({ 
          error: 'Invalid start date',
          message: 'Start date must be in the future',
          code: 'INVALID_START_DATE'
        });
      }

      // Check current subscription status
      const db = firebaseAdmin.database();
      const userRef = db.ref(`users/${userId}/account/subscription`);
      const snapshot = await userRef.once('value');
      const currentSubscription = snapshot.val();

      console.log('[Create Delayed Checkout] Current subscription status:', currentSubscription?.status);

      // Verify user has a canceled subscription that justifies delayed start
      if (currentSubscription?.status !== 'canceled') {
        return res.status(400).json({ 
          error: 'Invalid subscription state',
          message: 'Delayed subscriptions are only available for users with canceled subscriptions',
          code: 'INVALID_SUBSCRIPTION_STATE'
        });
      }

      // Create a Stripe checkout session with delayed start
      console.log('[Create Delayed Checkout] Creating Stripe checkout session with delayed start');

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.STRIPE_PREMIUM_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status?session_id={CHECKOUT_SESSION_ID}&delayed=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status`,
        customer_email: userEmail,
        metadata: {
          userId: userId,
          billingPeriod: 'monthly',
          userEmail: userEmail,
          upgradeType: 'delayed_premium_subscription',
          delayedStartDate: startDate
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        payment_method_collection: 'always',
        payment_method_options: {
          card: {
            setup_future_usage: 'off_session',
          },
        },
        subscription_data: {
          // Set the billing cycle anchor to the desired start date
          billing_cycle_anchor: startTimestamp,
          // Add trial period until the start date
          trial_end: startTimestamp,
          metadata: {
            userId: userId,
            billingPeriod: 'monthly',
            userEmail: userEmail,
            delayedStart: 'true',
            originalStartDate: startDate
          }
        },
      };
      
      console.log('[Create Delayed Checkout] Creating Stripe checkout session with params:', {
        mode: sessionParams.mode,
        priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
        trialEnd: new Date(startTimestamp * 1000).toISOString(),
        billingCycleAnchor: new Date(startTimestamp * 1000).toISOString()
      });
      
      let session;
      try {
        session = await stripe.checkout.sessions.create(sessionParams);
        console.log('[Create Delayed Checkout] Successfully created delayed checkout session:', { 
          sessionId: session.id,
          url: session.url 
        });
      } catch (stripeError: any) {
        console.error('[Create Delayed Checkout] Error creating Stripe checkout session:', {
          error: stripeError.message,
          code: stripeError.code,
          type: stripeError.type
        });
        
        return res.status(400).json({
          error: 'Failed to create delayed checkout session',
          message: stripeError.message || 'An error occurred with the payment processor',
          code: stripeError.code || 'STRIPE_ERROR'
        });
      }

      // Store the pending delayed subscription in our database
      try {
        await userRef.update({
          pendingDelayedSubscription: {
            sessionId: session.id,
            startDate: startDate,
            createdAt: Date.now(),
            status: 'pending_payment'
          },
          lastUpdated: Date.now()
        });
        
        console.log('[Create Delayed Checkout] Stored pending delayed subscription info');
      } catch (dbError) {
        console.error('[Create Delayed Checkout] Error storing delayed subscription info:', dbError);
        // Continue anyway as this is not critical for the checkout process
      }

      return res.status(200).json({ 
        sessionUrl: session.url,
        isDelayed: true,
        startDate: startDate,
        message: `Your subscription will start on ${new Date(startDate).toLocaleDateString()} to avoid overlapping with your current premium access.`
      });

    } catch (authError: any) {
      console.error('[Create Delayed Checkout] Auth error:', {
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
    console.error('[Create Delayed Checkout] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create delayed checkout session. Please try again later.',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}