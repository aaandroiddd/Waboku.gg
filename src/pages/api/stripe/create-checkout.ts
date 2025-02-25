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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.info('[Create Checkout] Started:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'POST') {
    console.warn('[Create Checkout] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    console.log('[Create Checkout] Firebase Admin initialized');
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[Create Checkout] No authorization header');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Please verify your email address before accessing subscription features.'
      });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Verify the token and get user data
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log('[Create Checkout] Verified user:', { userId, userEmail });

      if (!userEmail) {
        console.error('[Create Checkout] No user email found for user:', userId);
        return res.status(400).json({ 
          error: 'Missing email',
          message: 'User email is required for subscription'
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
          message: 'You already have an active subscription'
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
        message: authError.message,
        code: authError.code,
        stack: authError.stack
      });
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid authentication token'
      });
    }

  } catch (error: any) {
    console.error('[Create Checkout] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Handle Stripe-specific errors
    if (error.type?.startsWith('Stripe')) {
      return res.status(400).json({
        error: 'Payment processing error',
        message: error.message
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create checkout session. Please try again later.'
    });
  }
}