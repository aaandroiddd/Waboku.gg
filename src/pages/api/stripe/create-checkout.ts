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
  // Enhanced debug logging
  console.log('=== Stripe Checkout Debug Start ===');
  console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('Stripe Key Check:', !!process.env.STRIPE_SECRET_KEY);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Price ID Check:', !!process.env.STRIPE_PREMIUM_PRICE_ID);
  console.log('App URL Check:', !!process.env.NEXT_PUBLIC_APP_URL);
  console.log('Preview Mode:', process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview');
  console.log('=== Stripe Checkout Debug End ===');
  // Debug logging for Stripe configuration
  console.log('Stripe Key Check:', !!process.env.STRIPE_SECRET_KEY);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Price ID Check:', !!process.env.STRIPE_PREMIUM_PRICE_ID);
  console.log('[Stripe Checkout] Request received:', {
    method: req.method,
    hasAuth: !!req.headers.authorization,
    preview: process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview'
  });

  // Handle preview environment
  if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
    console.log('[Stripe Checkout] Running in preview mode');
    const successUrl = new URL('/dashboard/account-status', appUrl);
    successUrl.searchParams.append('upgrade', 'success');
    return res.status(200).json({
      sessionUrl: successUrl.toString(),
      isPreview: true
    });
  }
  
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
    const userEmail = decodedToken.email;

    if (!userEmail) {
      console.error('[Stripe Checkout] No email found for user:', userId);
      return res.status(400).json({
        error: 'User data error',
        message: 'User email is required for subscription'
      });
    }

    // Get user's account data
    const db = getDatabase();
    const userRef = db.ref(`users/${userId}/account`);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.val() || {};

    console.log('[Stripe Checkout] User data retrieved:', {
      userId,
      hasStripeCustomerId: !!userData?.stripeCustomerId,
      hasSubscription: !!userData?.subscription,
      subscriptionStatus: userData?.subscription?.status
    });

    // Check if user already has an active subscription
    if (userData?.subscription?.status === 'active') {
      console.log('[Stripe Checkout] User already has active subscription');
      return res.status(400).json({
        error: 'Subscription error',
        message: 'You already have an active subscription'
      });
    }

    // Handle customer creation/retrieval
    let stripeCustomerId = userData?.stripeCustomerId;

    if (stripeCustomerId) {
      // Verify the customer still exists in Stripe
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (customer.deleted) {
          console.log('[Stripe Checkout] Customer was deleted, creating new one');
          stripeCustomerId = null;
        }
      } catch (error) {
        console.log('[Stripe Checkout] Customer not found in Stripe, creating new one');
        stripeCustomerId = null;
      }
    }

    // Create new customer if needed
    if (!stripeCustomerId) {
      console.log('[Stripe Checkout] No existing customer ID, checking for existing customer by email');
      
      // First check if customer already exists with this email
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
        console.log('[Stripe Checkout] Found existing customer:', stripeCustomerId);
        
        // Update customer metadata if needed
        await stripe.customers.update(stripeCustomerId, {
          metadata: {
            userId: userId,
            firebaseEmail: userEmail
          }
        });
      } else {
        console.log('[Stripe Checkout] Creating new Stripe customer');
        try {
          const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
              userId: userId,
              firebaseEmail: userEmail
            }
          });
          stripeCustomerId = customer.id;
          console.log('[Stripe Checkout] New customer created:', {
            customerId: stripeCustomerId,
            userId: userId
          });
        } catch (error: any) {
          console.error('[Stripe Checkout] Customer creation failed:', error);
          return res.status(400).json({
            error: 'Customer creation failed',
            message: 'Unable to create customer record. Please try again.'
          });
        }
      }
      
      // Store the customer ID in Firebase
      try {
        await userRef.update({
          stripeCustomerId: stripeCustomerId
        });
      } catch (error) {
        console.error('[Stripe Checkout] Failed to update Firebase with customer ID:', error);
        // Don't fail the request, but log the error
      }
    }

    // Create the checkout session
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
          userId,
          firebaseEmail: userEmail
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
      customerId: stripeCustomerId,
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