import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.info('[Subscription Check] Started:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'GET') {
    console.warn('[Subscription Check] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[Subscription Check] No authorization header');
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

      console.log('[Subscription Check] Verified user:', userId);

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
        } catch (stripeError) {
          console.error('[Subscription Check] Stripe error:', stripeError);
          // If Stripe subscription not found, reset status
          if ((stripeError as any).code === 'resource_missing') {
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

      console.log('[Subscription Check] Status:', {
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

    } catch (authError) {
      console.error('[Subscription Check] Auth error:', authError);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

  } catch (error) {
    console.error('[Subscription Check] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check subscription status'
    });
  }
}