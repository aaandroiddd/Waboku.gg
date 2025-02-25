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
  console.log('[Create Checkout] Stripe initialized successfully');
} catch (error: any) {
  console.error('[Create Checkout] Failed to initialize Stripe:', {
    error: error.message,
    type: error.type,
    code: error.code
  });
  throw error;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Create Checkout ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization 
        ? `Bearer ${req.headers.authorization.split(' ')[1]?.substring(0, 5)}...${req.headers.authorization.split(' ')[1]?.slice(-5)}`
        : '**missing**'
    },
    body: req.body,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'POST') {
    console.warn(`[Create Checkout ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Create Checkout ${requestId}] Missing or invalid authorization header`);
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
      console.log(`[Create Checkout ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      const decodedToken = await admin.auth().verifyIdToken(idToken, true)
        .catch(async (error) => {
          console.error(`[Create Checkout ${requestId}] Token verification failed:`, {
            error: error.message,
            code: error.code
          });
          throw error;
        }); // Force token refresh check
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Create Checkout ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified,
        tokenIssued: new Date(decodedToken.iat * 1000).toISOString(),
        tokenExpires: new Date(decodedToken.exp * 1000).toISOString()
      });

      console.log('[Create Checkout] Token verified successfully:', { 
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified
      });

      if (!userEmail) {
        console.error('[Create Checkout] No user email found for user:', userId);
        return res.status(400).json({ 
          error: 'Missing email',
          message: 'User email is required for subscription',
          code: 'EMAIL_MISSING'
        });
      }

      // Check if user already has an active subscription
      const db = admin.database();
      const userRef = db.ref(`users/${userId}/account/subscription`);
      const snapshot = await userRef.once('value');
      const currentSubscription = snapshot.val();

      console.log('[Create Checkout] Current subscription status:', currentSubscription?.status);

      if (currentSubscription?.status === 'active') {
        return res.status(400).json({ 
          error: 'Subscription exists',
          message: 'You already have an active subscription',
          code: 'SUBSCRIPTION_EXISTS'
        });
      }

      // Preview environment handling
      if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
        console.log('[Create Checkout] Preview environment detected, returning simulated success');
        return res.status(200).json({ 
          sessionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status?session_id=preview_session`,
          isPreview: true
        });
      }

      console.log('[Create Checkout] Creating Stripe checkout session');

      // Create a Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.STRIPE_PREMIUM_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status`,
        customer_email: userEmail,
        metadata: {
          userId: userId,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        subscription_data: {
          metadata: {
            userId: userId,
          },
        },
      });

      console.log('[Create Checkout] Successfully created checkout session:', { 
        sessionId: session.id,
        url: session.url 
      });

      return res.status(200).json({ 
        sessionUrl: session.url,
        isPreview: false
      });

    } catch (authError: any) {
      console.error('[Create Checkout] Auth error:', {
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
    console.error('[Create Checkout] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Handle Stripe-specific errors
    if (error.type?.startsWith('Stripe')) {
      return res.status(400).json({
        error: 'Payment processing error',
        message: error.message,
        code: error.code || 'STRIPE_ERROR'
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create checkout session. Please try again later.',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}