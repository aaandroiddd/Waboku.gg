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
      const { admin: firebaseAdmin, auth } = getFirebaseAdmin();
      console.log(`[Create Checkout ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      try {
        // Verify the token and get user data
        const decodedToken = await auth.verifyIdToken(idToken, true);
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

        // Check if user already has an active subscription in our database
        const db = firebaseAdmin.database();
        const userRef = db.ref(`users/${userId}/account/subscription`);
        const snapshot = await userRef.once('value');
        const currentSubscription = snapshot.val();

        console.log('[Create Checkout] Current subscription status:', currentSubscription?.status);

        // Get the full account data to check for canceled status
        const accountRef = db.ref(`users/${userId}/account`);
        const accountSnapshot = await accountRef.once('value');
        const accountData = accountSnapshot.val();
        
        console.log('[Create Checkout] Account subscription status:', accountData?.subscription?.status);

        // Check if the subscription is canceled
        const isCanceled = currentSubscription?.status === 'canceled' || accountData?.subscription?.status === 'canceled';
        
        // Only block if the subscription is active and NOT canceled
        if (currentSubscription?.status === 'active' && !isCanceled) {
          // Before blocking, check if this might be a user who deleted their account and signed up again
          // Look for customer in Stripe by email
          try {
            const customers = await stripe.customers.list({
              email: userEmail,
              limit: 1
            });
            
            if (customers.data.length > 0) {
              const customer = customers.data[0];
              console.log('[Create Checkout] Found existing Stripe customer for email:', {
                email: userEmail,
                customerId: customer.id
              });
              
              // Check if this customer has any active subscriptions
              const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'active',
                limit: 1
              });
              
              // If there's an active subscription in Stripe but not in our database,
              // it likely means the user deleted their account and signed up again
              if (subscriptions.data.length > 0) {
                console.log('[Create Checkout] Found active subscription in Stripe but not in our database:', {
                  subscriptionId: subscriptions.data[0].id,
                  status: subscriptions.data[0].status
                });
                
                // Cancel the existing subscription in Stripe
                await stripe.subscriptions.update(subscriptions.data[0].id, {
                  cancel_at_period_end: true
                });
                
                console.log('[Create Checkout] Canceled previous subscription for resubscribing user');
              }
            }
          } catch (stripeError) {
            // Log but continue - this is just a best-effort check
            console.error('[Create Checkout] Error checking for existing Stripe customer:', stripeError);
          }
          
          // If we still have an active subscription in our database, block the checkout
          if (currentSubscription?.status === 'active' && !isCanceled) {
            return res.status(400).json({ 
              error: 'Subscription exists',
              message: 'You already have an active subscription',
              code: 'SUBSCRIPTION_EXISTS'
            });
          }
        }
        
        // If subscription is canceled or we're resubscribing, clear it from the database before creating a new one
        if (currentSubscription?.status === 'canceled' || accountData?.subscription?.status === 'canceled') {
          console.log('[Create Checkout] Clearing canceled subscription before creating new one:', {
            userId,
            subscriptionId: currentSubscription?.stripeSubscriptionId
          });
          
          // Clear the subscription status in Realtime Database
          try {
            // Update subscription fields to indicate it's being replaced
            await userRef.update({
              status: 'replaced',
              lastUpdated: Date.now()
            });
            
            console.log('[Create Checkout] Cleared canceled subscription status');
          } catch (clearError) {
            console.error('[Create Checkout] Error clearing canceled subscription:', clearError);
            // Continue anyway as this is not critical
          }
        }
        
        // If we get here, either there's no subscription or it's canceled, so allow checkout

        // Always create a real Stripe checkout session, even in preview mode
        console.log('[Create Checkout] Creating Stripe checkout session for all environments');

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
            }
            // Removed conflicting parameters that were causing errors
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