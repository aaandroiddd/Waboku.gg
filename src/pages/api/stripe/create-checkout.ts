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
  console.log('Starting checkout process...');

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    const auth = getAuth();
    const db = getDatabase();
    
    // Get the Firebase ID token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid authorization header');
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
      console.error('Token verification error:', error);
      return res.status(401).json({ 
        error: 'Authentication error',
        message: 'Invalid authentication token'
      });
    }

    const userId = decodedToken.uid;
    console.log('Processing checkout for user:', userId);

    // Even in preview environment, we'll use real Stripe checkout
    // Just log that we're in preview mode for debugging
    if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
      console.log('Preview environment detected, proceeding with Stripe checkout...');
    }

    // Production environment - handle actual Stripe checkout
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PREMIUM_PRICE_ID) {
      console.error('Missing required Stripe environment variables');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Stripe configuration is incomplete'
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    // Get user's account data
    const userSnapshot = await db.ref(`users/${userId}/account`).get();
    const userData = userSnapshot.val();
    
    console.log('Creating Stripe checkout session for user:', userId);
    
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
      console.log('Using existing Stripe customer ID:', userData.stripeCustomerId);
      sessionConfig.customer = userData.stripeCustomerId;
    } else if (decodedToken.email) {
      console.log('Setting customer email:', decodedToken.email);
      sessionConfig.customer_email = decodedToken.email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    if (!session.url) {
      console.error('No session URL returned from Stripe');
      throw new Error('No session URL returned from Stripe');
    }

    console.log('Checkout session created successfully');
    return res.status(200).json({ sessionUrl: session.url });
  } catch (error: any) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}