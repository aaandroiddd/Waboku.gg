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

      console.log('[Create Checkout] Verified user:', userId);

      if (!userEmail) {
        return res.status(400).json({ error: 'User email is required' });
      }

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
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        customer_email: userEmail,
        metadata: {
          userId: userId,
        },
      });

      return res.status(200).json({ url: session.url });

    } catch (authError) {
      console.error('[Create Checkout] Auth error:', authError);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

  } catch (error) {
    console.error('[Create Checkout] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create checkout session'
    });
  }
}