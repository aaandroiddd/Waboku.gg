import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
  throw new Error('STRIPE_PREMIUM_PRICE_ID is not set');
}

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Get Firebase Admin instance
    const { auth } = getFirebaseAdmin();
    
    // Get the Firebase ID token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
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
      return res.status(401).json({ 
        error: 'Authentication error',
        message: 'Invalid authentication token'
      });
    }

    const userId = decodedToken.uid;

    // For preview environment, return a special development success URL
    if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
      return res.status(200).json({ 
        sessionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/dev-success?userId=${userId}`,
        isPreview: true 
      });
    }

    // Create a new Stripe checkout session with error handling
    try {
      // Get user's Firestore data to check if they have a customer ID
      const db = getFirebaseAdmin().firestore();
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      let sessionConfig: Stripe.Checkout.SessionCreateParams = {
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
        metadata: {
          userId,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      };

      // If user has a Stripe customer ID, use it to ensure proper subscription linking
      if (userData?.stripeCustomerId) {
        sessionConfig.customer = userData.stripeCustomerId;
      } else {
        sessionConfig.customer_email = decodedToken.email || undefined;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      if (!session.url) {
        throw new Error('No session URL returned from Stripe');
      }

      return res.status(200).json({ sessionUrl: session.url });
    } catch (stripeError: any) {
      console.error('Stripe error:', stripeError);
      return res.status(500).json({ 
        error: 'Stripe error',
        message: stripeError.message || 'Failed to create checkout session'
      });
    }
  } catch (error: any) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: 'An unexpected error occurred'
    });
  }
}