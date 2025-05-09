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

        // First, check if this might be a user who deleted their account and signed up again
        // Look for customer in Stripe by email BEFORE checking our database
        let foundStripeSubscription = false;
        let stripeCustomerId = null;
        
        try {
          console.log('[Create Checkout] Checking for existing Stripe customer by email:', userEmail);
          const customers = await stripe.customers.list({
            email: userEmail,
            limit: 1
          });
          
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
            console.log('[Create Checkout] Found existing Stripe customer:', {
              email: userEmail,
              customerId: stripeCustomerId
            });
            
            // Check if this customer has any active subscriptions
            const subscriptions = await stripe.subscriptions.list({
              customer: stripeCustomerId,
              status: 'active',
              limit: 5
            });
            
            // If there are active subscriptions in Stripe, cancel them
            if (subscriptions.data.length > 0) {
              console.log('[Create Checkout] Found active subscriptions in Stripe:', {
                count: subscriptions.data.length,
                subscriptionIds: subscriptions.data.map(sub => sub.id)
              });
              
              foundStripeSubscription = true;
              
              // Cancel all existing subscriptions
              for (const subscription of subscriptions.data) {
                await stripe.subscriptions.cancel(subscription.id);
                console.log('[Create Checkout] Canceled existing subscription:', subscription.id);
              }
            }
          }
        } catch (stripeError) {
          // Log but continue - this is just a best-effort check
          console.error('[Create Checkout] Error checking for existing Stripe customer:', stripeError);
        }

        // Now check our database
        const db = firebaseAdmin.database();
        const userRef = db.ref(`users/${userId}/account/subscription`);
        const snapshot = await userRef.once('value');
        const currentSubscription = snapshot.val();

        console.log('[Create Checkout] Current subscription status in database:', currentSubscription?.status);

        // Get the full account data to check for canceled status
        const accountRef = db.ref(`users/${userId}/account`);
        const accountSnapshot = await accountRef.once('value');
        const accountData = accountSnapshot.val();
        
        console.log('[Create Checkout] Account subscription status in database:', accountData?.subscription?.status);

        // Check if the subscription is canceled in our database
        const isCanceled = currentSubscription?.status === 'canceled' || accountData?.subscription?.status === 'canceled';
        
        // If we found and canceled a Stripe subscription, clear any subscription data in our database
        if (foundStripeSubscription) {
          console.log('[Create Checkout] Clearing database subscription data after canceling Stripe subscription');
          try {
            // Clear the subscription status in Realtime Database
            await userRef.update({
              status: 'none',
              stripeSubscriptionId: null,
              lastUpdated: Date.now()
            });
            
            console.log('[Create Checkout] Cleared subscription data in database');
          } catch (clearError) {
            console.error('[Create Checkout] Error clearing subscription data:', clearError);
            // Continue anyway as this is not critical
          }
        }
        // Only block if the subscription is active in our database, NOT canceled, and we didn't just cancel a Stripe subscription
        else if (currentSubscription?.status === 'active' && !isCanceled) {
          console.log('[Create Checkout] User already has an active subscription:', {
            userId,
            subscriptionId: currentSubscription?.stripeSubscriptionId,
            status: currentSubscription?.status
          });
          return res.status(400).json({ 
            error: 'Subscription exists',
            message: 'You already have an active subscription',
            code: 'SUBSCRIPTION_EXISTS'
          });
        }
        
        // Log the current subscription state for debugging
        console.log('[Create Checkout] Current subscription state before proceeding:', {
          userId,
          status: currentSubscription?.status || 'none',
          isCanceled,
          stripeSubscriptionId: currentSubscription?.stripeSubscriptionId || 'none',
          accountTier: accountData?.tier || 'free'
        });
        
        // If subscription is canceled or we're resubscribing, clear it from the database before creating a new one
        if ((currentSubscription?.status === 'canceled' || accountData?.subscription?.status === 'canceled') && !foundStripeSubscription) {
          console.log('[Create Checkout] Clearing canceled subscription before creating new one:', {
            userId,
            subscriptionId: currentSubscription?.stripeSubscriptionId
          });
          
          // Clear the subscription status in Realtime Database
          try {
            // Update subscription fields to indicate it's being replaced
            await userRef.update({
              status: 'none',
              stripeSubscriptionId: null,
              lastUpdated: Date.now()
            });
            
            console.log('[Create Checkout] Cleared canceled subscription status');
          } catch (clearError) {
            console.error('[Create Checkout] Error clearing canceled subscription:', clearError);
            // Continue anyway as this is not critical
          }
        }
        
        // For free tier users, ensure we have a clean state
        if (!currentSubscription || currentSubscription.status === 'none' || accountData?.tier === 'free') {
          console.log('[Create Checkout] Free tier user upgrading to premium:', {
            userId,
            email: userEmail,
            currentTier: accountData?.tier || 'free'
          });
          
          // No need to clear anything, just proceed with checkout
        }
        
        // If we get here, either there's no subscription or it's canceled, so allow checkout

        // Always create a real Stripe checkout session, even in preview mode
        console.log('[Create Checkout] Creating Stripe checkout session for all environments');

        console.log('[Create Checkout] Creating Stripe checkout session');

        // Create a Checkout Session
        // If we found a Stripe customer, use that customer ID instead of email
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
            userId: userId,
            billingPeriod: 'monthly',
            userEmail: userEmail,
            upgradeType: 'premium_subscription'
          },
          allow_promotion_codes: true,
          billing_address_collection: 'auto',
          subscription_data: {
            metadata: {
              userId: userId,
              billingPeriod: 'monthly',
              userEmail: userEmail
            }
          },
        };
        
        // If we found an existing customer, use that instead of creating a new one
        if (stripeCustomerId) {
          sessionParams.customer = stripeCustomerId;
          console.log('[Create Checkout] Using existing Stripe customer:', stripeCustomerId);
        } else {
          sessionParams.customer_email = userEmail;
          console.log('[Create Checkout] Creating new customer with email:', userEmail);
        }
        
        console.log('[Create Checkout] Creating Stripe checkout session with params:', {
          mode: sessionParams.mode,
          priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
          hasCustomer: !!stripeCustomerId,
          hasEmail: !!userEmail
        });
        
        let session;
        try {
          session = await stripe.checkout.sessions.create(sessionParams);
          console.log('[Create Checkout] Successfully created checkout session:', { 
            sessionId: session.id,
            url: session.url 
          });
        } catch (stripeError: any) {
          console.error('[Create Checkout] Error creating Stripe checkout session:', {
            error: stripeError.message,
            code: stripeError.code,
            type: stripeError.type
          });
          
          return res.status(400).json({
            error: 'Failed to create checkout session',
            message: stripeError.message || 'An error occurred with the payment processor',
            code: stripeError.code || 'STRIPE_ERROR'
          });
        }

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