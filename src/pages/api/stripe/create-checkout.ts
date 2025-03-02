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
      // Initialize Firebase Admin
      const admin = getFirebaseAdmin();
      console.log(`[Create Checkout ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      try {
        // Verify the token and get user data
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        console.log(`[Create Checkout ${requestId}] Token verified successfully:`, {
          userId,
          email: userEmail,
          emailVerified: decodedToken.email_verified,
          tokenIssued: new Date(decodedToken.iat * 1000).toISOString(),
          tokenExpires: new Date(decodedToken.exp * 1000).toISOString()
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

        // Only block if the subscription is active and not canceled
        if (currentSubscription?.status === 'active' && currentSubscription?.status !== 'canceled') {
          // Check if this is a resubscription attempt for a canceled subscription
          const accountRef = db.ref(`users/${userId}/account`);
          const accountSnapshot = await accountRef.once('value');
          const accountData = accountSnapshot.val();
          
          // If the subscription is marked as canceled in the account data, allow resubscription
          if (accountData?.subscription?.status === 'canceled') {
            console.log('[Create Checkout] Allowing resubscription for canceled subscription');
          } else {
            return res.status(400).json({ 
              error: 'Subscription exists',
              message: 'You already have an active subscription',
              code: 'SUBSCRIPTION_EXISTS'
            });
          }
        }

        // Preview environment handling
        if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
          console.log('[Create Checkout] Preview environment detected, simulating checkout');
          
          try {
            // Update user's subscription status directly in preview mode
            await db.ref(`users/${userId}/account`).update({
              tier: 'premium',
              status: 'active',
              subscription: {
                status: 'active',
                tier: 'premium',
                billingPeriod: 'monthly', // Explicitly set to monthly
                stripeSubscriptionId: `preview_${Date.now()}`,
                startDate: new Date().toISOString(),
                renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now in seconds
                lastUpdated: Date.now()
              }
            });
            
            // Also update in Firestore for consistency
            const firestore = admin.firestore();
            await firestore.collection('users').doc(userId).set({
              accountTier: 'premium',
              subscription: {
                currentPlan: 'premium',
                status: 'active',
                billingPeriod: 'monthly', // Explicitly set to monthly
                stripeSubscriptionId: `preview_${Date.now()}`,
                startDate: new Date().toISOString(),
                renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
              }
            }, { merge: true });
            
            console.log('[Create Checkout] Preview mode: Updated subscription data for user:', userId);
          } catch (previewError) {
            console.error('[Create Checkout] Preview mode update failed:', previewError);
          }
          
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
            billingPeriod: 'monthly'
          },
          allow_promotion_codes: true,
          billing_address_collection: 'auto',
          subscription_data: {
            metadata: {
              userId: userId,
              billingPeriod: 'monthly'
            },
            // Ensure the subscription is monthly
            trial_period_days: null,
            billing_cycle_anchor: null
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
      } catch (verifyError: any) {
        console.error(`[Create Checkout ${requestId}] Token verification failed:`, {
          error: verifyError.message,
          code: verifyError.code,
          stack: verifyError.stack
        });
        throw verifyError;
      }

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