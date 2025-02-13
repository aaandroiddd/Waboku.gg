import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin at the module level
try {
  getFirebaseAdmin();
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Stripe Checkout] Starting checkout process...');

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
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
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

    const auth = getAuth();
    const db = getDatabase();
    
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

    // Initialize Stripe with error handling
    let stripe: Stripe;
    try {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16',
        typescript: true,
      });
    } catch (error: any) {
      console.error('[Stripe Checkout] Stripe initialization error:', error);
      return res.status(500).json({
        error: 'Payment service error',
        message: 'Failed to initialize payment service',
        details: error.message
      });
    }

    // Get user's account data
    let userData;
    try {
      const userSnapshot = await db.ref(`users/${userId}/account`).get();
      userData = userSnapshot.val();
      console.log('[Stripe Checkout] User data retrieved:', JSON.stringify(userData));
    } catch (error: any) {
      console.error('[Stripe Checkout] Error fetching user data:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user data',
        details: error.message
      });
    }

    // Verify the price ID exists in Stripe
    try {
      const price = await stripe.prices.retrieve(process.env.STRIPE_PREMIUM_PRICE_ID!);
      console.log('[Stripe Checkout] Price verified:', price.id);
    } catch (error: any) {
      console.error('[Stripe Checkout] Invalid price ID:', error);
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Invalid price configuration',
        details: error.message
      });
    }
    
    console.log('[Stripe Checkout] Creating checkout session for user:', userId);
    
    let sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status?upgrade=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-status`,
      metadata: {
        userId,
        isResubscription: userData?.subscription?.status === 'canceled' ? 'true' : 'false'
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    };

    // If user has a Stripe customer ID, use it
    if (userData?.stripeCustomerId) {
      console.log('[Stripe Checkout] Using existing Stripe customer ID:', userData.stripeCustomerId);
      sessionConfig.customer = userData.stripeCustomerId;
    } else if (decodedToken.email) {
      console.log('[Stripe Checkout] Setting customer email:', decodedToken.email);
      sessionConfig.customer_email = decodedToken.email;
    }

    console.log('[Stripe Checkout] Creating session with config:', JSON.stringify(sessionConfig));
    
    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionConfig);
    } catch (error: any) {
      console.error('[Stripe Checkout] Session creation error:', error);
      return res.status(500).json({
        error: 'Payment service error',
        message: 'Failed to create checkout session',
        details: error.message
      });
    }

    if (!session.url) {
      console.error('[Stripe Checkout] No session URL returned from Stripe');
      return res.status(500).json({
        error: 'Payment service error',
        message: 'Invalid checkout session response'
      });
    }

    console.log('[Stripe Checkout] Session created successfully:', session.id);
    return res.status(200).json({ sessionUrl: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout] Unhandled server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}