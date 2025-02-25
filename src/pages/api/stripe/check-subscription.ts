import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Subscription Check ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization 
        ? `Bearer ${req.headers.authorization.split(' ')[1]?.substring(0, 5)}...${req.headers.authorization.split(' ')[1]?.slice(-5)}`
        : '**missing**'
    },
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'GET') {
    console.warn(`[Subscription Check ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Subscription Check ${requestId}] Missing or invalid authorization header`);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Missing or invalid authorization token',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Initialize Firebase Admin and verify token
      const admin = getFirebaseAdmin();
      console.log(`[Subscription Check ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      const decodedToken = await admin.auth().verifyIdToken(idToken, true); // Force token refresh check
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Subscription Check ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified,
        tokenIssued: new Date(decodedToken.iat * 1000).toISOString(),
        tokenExpires: new Date(decodedToken.exp * 1000).toISOString()
      });

      console.log('[Subscription Check] Token verified successfully:', { 
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified
      });

      // Get subscription data from Realtime Database
      const realtimeDb = getDatabase();
      const userRef = realtimeDb.ref(`users/${userId}/account`);
      
      const snapshot = await userRef.once('value');
      const accountData = snapshot.val();

      if (!accountData || !accountData.subscription) {
        console.log('[Subscription Check] No subscription found:', { userId });
        return res.status(200).json({ 
          isPremium: false,
          status: 'none',
          tier: 'free'
        });
      }

      const { subscription } = accountData;
      
      // If there's a Stripe subscription ID, verify with Stripe
      let stripeSubscription = null;
      if (subscription.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          
          // Update subscription status from Stripe
          subscription.status = stripeSubscription.status;
          subscription.currentPeriodEnd = stripeSubscription.current_period_end;
          
          // Update the database with latest Stripe status
          await userRef.child('subscription').update({
            status: stripeSubscription.status,
            currentPeriodEnd: stripeSubscription.current_period_end
          });

          console.log('[Subscription Check] Updated Stripe subscription status:', {
            userId,
            status: stripeSubscription.status,
            currentPeriodEnd: stripeSubscription.current_period_end
          });
        } catch (stripeError: any) {
          console.error('[Subscription Check] Stripe error:', {
            code: stripeError.code,
            message: stripeError.message,
            type: stripeError.type
          });
          
          // If Stripe subscription not found, reset status
          if (stripeError.code === 'resource_missing') {
            subscription.status = 'none';
            await userRef.child('subscription').update({
              status: 'none',
              stripeSubscriptionId: null
            });
          }
        }
      }
      
      const now = Date.now() / 1000;
      const isActive = (subscription.status === 'active' || subscription.status === 'trialing') && 
                      subscription.currentPeriodEnd && 
                      subscription.currentPeriodEnd > now;

      console.log('[Subscription Check] Final status:', {
        userId,
        isActive,
        subscription: {
          status: subscription.status,
          tier: subscription.tier,
          currentPeriodEnd: subscription.currentPeriodEnd
        }
      });

      return res.status(200).json({
        isPremium: isActive && subscription.tier === 'premium',
        status: subscription.status || 'none',
        tier: subscription.tier || 'free',
        currentPeriodEnd: subscription.currentPeriodEnd
      });

    } catch (authError: any) {
      console.error('[Subscription Check] Auth error:', {
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
    console.error('[Subscription Check] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check subscription status',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}