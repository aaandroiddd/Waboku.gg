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

if (!stripeSecretKey || !stripePriceId || !appUrl) {
  console.error('[Stripe Checkout] Missing required environment variables:', {
    hasStripeKey: !!stripeSecretKey,
    hasPriceId: !!stripePriceId,
    hasAppUrl: !!appUrl
  });
}

// Initialize Stripe with proper error handling
let stripe: Stripe;
try {
  if (!stripeSecretKey) {
    throw new Error('Stripe secret key is not configured');
  }
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
} catch (error) {
  console.error('[Stripe Checkout] Stripe initialization error:', error);
  throw error;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle preview environment
  if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
    console.log('[Stripe Checkout] Running in preview mode');
    // Ensure we're using the correct path for redirection
    const successUrl = new URL('/dashboard/account-status', process.env.NEXT_PUBLIC_APP_URL);
    successUrl.searchParams.append('upgrade', 'success');
    return res.status(200).json({
      sessionUrl: successUrl.toString(),
      isPreview: true
    });
  }
  console.log('[Stripe Checkout] Starting checkout process...', {
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
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
    if (!stripeSecretKey || !stripePriceId || !appUrl) {
      console.error('[Stripe Checkout] Missing required environment variables');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Payment service configuration is incomplete'
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
      console.log('[Stripe Checkout] Token verified for user:', decodedToken.uid);
    } catch (error: any) {
      console.error('[Stripe Checkout] Token verification error:', error);
      return res.status(401).json({ 
        error: 'Authentication error',
        message: 'Invalid authentication token'
      });
    }

    const userId = decodedToken.uid;

    // Get user's account data
    const db = getDatabase();
    const userRef = db.ref(`users/${userId}/account`);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.val() || {};

    console.log('[Stripe Checkout] User data retrieved:', {
      userId,
      hasSubscription: !!userData?.subscription,
      subscriptionStatus: userData?.subscription?.status,
      accountTier: userData?.tier
    });

    // Check if user already has an active subscription
    if (userData?.subscription?.status === 'active') {
      console.log('[Stripe Checkout] User already has active subscription');
      return res.status(400).json({
        error: 'Subscription error',
        message: 'You already have an active subscription'
      });
    }

    // Verify the price exists in Stripe
    try {
      await stripe.prices.retrieve(stripePriceId);
    } catch (error: any) {
      console.error('[Stripe Checkout] Price verification error:', error);
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Invalid price configuration'
      });
    }
    
    // Check if user already has a Stripe customer ID
    let stripeCustomerId = userData?.stripeCustomerId;

    // If no customer ID exists, create a new customer
    if (!stripeCustomerId) {
      console.log('[Stripe Checkout] Creating new customer for user:', userId);
      const customer = await stripe.customers.create({
        email: decodedToken.email,
        metadata: {
          userId: userId
        }
      });
      stripeCustomerId = customer.id;
      
      // Store the customer ID in Firebase
      await userRef.update({
        stripeCustomerId: stripeCustomerId
      });
    }

    // Create the checkout session with the customer ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard/account-status?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/account-status`,
      client_reference_id: userId,
      customer: stripeCustomerId,
      metadata: {
        userId,
        isResubscription: userData?.subscription?.status === 'canceled' ? 'true' : 'false'
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        metadata: {
          userId
        }
      }
    });

    if (!session?.url) {
      console.error('[Stripe Checkout] No session URL in response');
      return res.status(500).json({
        error: 'Payment service error',
        message: 'Failed to create checkout session'
      });
    }

    console.log('[Stripe Checkout] Session created successfully:', {
      sessionId: session.id,
      hasUrl: !!session.url
    });
    
    return res.status(200).json({ sessionUrl: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout] Unhandled error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}