import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin at the module level
try {
  getFirebaseAdmin();
} catch (error) {
  console.error('[Stripe Checkout] Firebase Admin initialization error:', error);
}

// Validate environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!stripeSecretKey) {
  console.error('[Stripe Checkout] STRIPE_SECRET_KEY is not set');
}

if (!stripePriceId) {
  console.error('[Stripe Checkout] STRIPE_PREMIUM_PRICE_ID is not set');
}

if (!appUrl) {
  console.error('[Stripe Checkout] NEXT_PUBLIC_APP_URL is not set');
}

if (!stripeSecretKey?.startsWith('sk_')) {
  console.error('[Stripe Checkout] Invalid STRIPE_SECRET_KEY format');
}

const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Stripe Checkout] Starting checkout process...');
  
  // Log request details (excluding sensitive data)
  console.log('[Stripe Checkout] Request details:', {
    method: req.method,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '[REDACTED]' : undefined
    }
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[Stripe Checkout] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Validate environment variables first
    const requiredEnvVars = {
      STRIPE_SECRET_KEY: stripeSecretKey,
      STRIPE_PREMIUM_PRICE_ID: stripePriceId,
      NEXT_PUBLIC_APP_URL: appUrl
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error('[Stripe Checkout] Missing environment variables:', missingVars);
      return res.status(500).json({
        error: 'Configuration error',
        message: `Payment service configuration is incomplete (missing: ${missingVars.join(', ')})`
      });
    }

    // Get the Firebase ID token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[Stripe Checkout] Missing or invalid authorization header');
      return res.status(401).json({ 
        error: 'Authentication error',
        message: 'Missing or invalid authorization header'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const auth = getAuth();
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error('[Stripe Checkout] Token verification error:', error);
      return res.status(401).json({ 
        error: 'Authentication error',
        message: 'Invalid authentication token',
        details: error.message
      });
    }

    const userId = decodedToken.uid;
    console.log('[Stripe Checkout] Processing checkout for user:', userId);

    // Get user's account data
    const db = getDatabase();
    let userData;
    try {
      const userSnapshot = await db.ref(`users/${userId}/account`).get();
      userData = userSnapshot.val() || {};
      console.log('[Stripe Checkout] User data retrieved:', {
        ...userData,
        stripeCustomerId: userData?.stripeCustomerId ? '[REDACTED]' : undefined
      });
    } catch (error: any) {
      console.error('[Stripe Checkout] Error fetching user data:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user data',
        details: error.message
      });
    }

    // Check if user already has an active subscription
    if (userData?.subscription?.status === 'active') {
      console.log('[Stripe Checkout] User already has an active subscription');
      return res.status(400).json({
        error: 'Subscription error',
        message: 'You already have an active subscription'
      });
    }

    // Verify the price ID exists in Stripe
    try {
      console.log('[Stripe Checkout] Verifying price ID:', stripePriceId);
      const price = await stripe.prices.retrieve(stripePriceId!);
      console.log('[Stripe Checkout] Price verified:', price.id);
    } catch (error: any) {
      console.error('[Stripe Checkout] Invalid price ID:', error);
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Invalid price configuration',
        details: error.message
      });
    }
    
    // Prepare session configuration
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard/account-status?upgrade=success`,
      cancel_url: `${appUrl}/dashboard/account-status`,
      client_reference_id: userId,
      metadata: {
        userId,
        isResubscription: userData?.subscription?.status === 'canceled' ? 'true' : 'false'
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    };

    // If user has a Stripe customer ID, use it
    if (userData?.stripeCustomerId) {
      console.log('[Stripe Checkout] Using existing Stripe customer ID');
      sessionConfig.customer = userData.stripeCustomerId;
    } else if (decodedToken.email) {
      console.log('[Stripe Checkout] Setting customer email');
      sessionConfig.customer_email = decodedToken.email;
    }

    console.log('[Stripe Checkout] Creating session with config:', {
      ...sessionConfig,
      customer_email: sessionConfig.customer_email ? '[REDACTED]' : undefined,
      customer: sessionConfig.customer ? '[REDACTED]' : undefined
    });
    
    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionConfig);
    } catch (error: any) {
      console.error('[Stripe Checkout] Session creation error:', {
        message: error.message,
        type: error.type,
        code: error.code,
        param: error.param
      });
      return res.status(500).json({
        error: 'Payment service error',
        message: 'Failed to create checkout session',
        details: error.message
      });
    }

    if (!session?.url) {
      console.error('[Stripe Checkout] No session URL returned from Stripe');
      return res.status(500).json({
        error: 'Payment service error',
        message: 'Invalid checkout session response'
      });
    }

    console.log('[Stripe Checkout] Session created successfully:', session.id);
    return res.status(200).json({ sessionUrl: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout] Unhandled server error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An unexpected error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}