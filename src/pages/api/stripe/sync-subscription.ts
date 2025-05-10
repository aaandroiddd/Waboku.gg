import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { syncSubscriptionData } from '@/lib/subscription-sync';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  maxNetworkRetries: 3,
  timeout: 20000
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Subscription Sync ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'POST') {
    console.warn(`[Subscription Sync ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Subscription Sync ${requestId}] Missing or invalid authorization header`);
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
      const { admin } = getFirebaseAdmin();
      console.log(`[Subscription Sync ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Subscription Sync ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified
      });

      // Get Firestore and Realtime Database references
      const firestore = admin.firestore();
      const realtimeDb = admin.database();
      
      // Check if the user has a subscription in Stripe
      let stripeSubscription = null;
      let stripeCustomer = null;
      
      try {
        // First, find the customer by email
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          stripeCustomer = customers.data[0];
          console.log(`[Subscription Sync ${requestId}] Found Stripe customer:`, {
            customerId: stripeCustomer.id,
            email: userEmail
          });
          
          // Look for active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomer.id,
            status: 'active',
            limit: 1
          });
          
          if (subscriptions.data.length > 0) {
            stripeSubscription = subscriptions.data[0];
            console.log(`[Subscription Sync ${requestId}] Found active Stripe subscription:`, {
              subscriptionId: stripeSubscription.id,
              status: stripeSubscription.status,
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString()
            });
          } else {
            console.log(`[Subscription Sync ${requestId}] No active subscriptions found for customer:`, stripeCustomer.id);
            
            // Check for canceled subscriptions that might still be active
            const canceledSubscriptions = await stripe.subscriptions.list({
              customer: stripeCustomer.id,
              status: 'canceled',
              limit: 1
            });
            
            if (canceledSubscriptions.data.length > 0) {
              const canceledSub = canceledSubscriptions.data[0];
              const endDate = new Date(canceledSub.current_period_end * 1000);
              const now = new Date();
              
              if (endDate > now) {
                // This subscription is canceled but still active until the end date
                stripeSubscription = canceledSub;
                console.log(`[Subscription Sync ${requestId}] Found canceled but active Stripe subscription:`, {
                  subscriptionId: stripeSubscription.id,
                  status: 'canceled',
                  endDate: endDate.toISOString()
                });
              }
            }
          }
        } else {
          console.log(`[Subscription Sync ${requestId}] No Stripe customer found for email:`, userEmail);
        }
      } catch (stripeError) {
        console.error(`[Subscription Sync ${requestId}] Error checking Stripe subscription:`, stripeError);
      }
      
      // Prepare subscription data for sync
      let subscriptionData: any = {};
      
      if (stripeSubscription) {
        // We have a Stripe subscription, use it as the source of truth
        const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
        const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
        
        subscriptionData = {
          status: stripeSubscription.status,
          stripeSubscriptionId: stripeSubscription.id,
          startDate: currentPeriodStart.toISOString(),
          endDate: currentPeriodEnd.toISOString(),
          renewalDate: currentPeriodEnd.toISOString(),
          currentPeriodEnd: stripeSubscription.current_period_end,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
          tier: 'premium',
          currentPlan: 'premium'
        };
      } else {
        // No Stripe subscription found, check Firestore for existing data
        try {
          const userDoc = await firestore.collection('users').doc(userId).get();
          const userData = userDoc.exists ? userDoc.data() : null;
          
          if (userData?.subscription?.stripeSubscriptionId) {
            console.log(`[Subscription Sync ${requestId}] Found subscription data in Firestore but not in Stripe:`, {
              stripeSubscriptionId: userData.subscription.stripeSubscriptionId,
              status: userData.subscription.status
            });
            
            // If we have a subscription ID in Firestore but not in Stripe, it might be invalid
            // Check if it's an admin subscription
            if (userData.subscription.stripeSubscriptionId.startsWith('admin_')) {
              // Admin subscriptions are valid even if not in Stripe
              subscriptionData = {
                ...userData.subscription,
                status: userData.subscription.status || 'active',
                tier: 'premium',
                currentPlan: 'premium'
              };
              
              console.log(`[Subscription Sync ${requestId}] Keeping admin subscription:`, {
                stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
                status: subscriptionData.status
              });
            } else {
              // Regular subscription not found in Stripe, mark as inactive
              subscriptionData = {
                status: 'none',
                stripeSubscriptionId: null,
                tier: 'free',
                currentPlan: 'free'
              };
              
              console.log(`[Subscription Sync ${requestId}] Marking invalid subscription as inactive:`, {
                oldStripeSubscriptionId: userData.subscription.stripeSubscriptionId
              });
            }
          } else {
            // No subscription data in Firestore either
            subscriptionData = {
              status: 'none',
              stripeSubscriptionId: null,
              tier: 'free',
              currentPlan: 'free'
            };
            
            console.log(`[Subscription Sync ${requestId}] No subscription data found in Firestore`);
          }
        } catch (firestoreError) {
          console.error(`[Subscription Sync ${requestId}] Error checking Firestore:`, firestoreError);
          
          // Default to free tier if we can't check Firestore
          subscriptionData = {
            status: 'none',
            stripeSubscriptionId: null,
            tier: 'free',
            currentPlan: 'free'
          };
        }
      }
      
      // Sync the subscription data to both databases
      console.log(`[Subscription Sync ${requestId}] Syncing subscription data:`, {
        userId,
        status: subscriptionData.status,
        tier: subscriptionData.tier,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId
      });
      
      const syncResult = await syncSubscriptionData(userId, subscriptionData);
      
      if (syncResult.success) {
        console.log(`[Subscription Sync ${requestId}] Subscription data synced successfully`);
        
        return res.status(200).json({
          success: true,
          message: 'Subscription data synchronized successfully',
          subscription: {
            status: subscriptionData.status,
            tier: subscriptionData.tier,
            stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
            startDate: subscriptionData.startDate,
            endDate: subscriptionData.endDate,
            renewalDate: subscriptionData.renewalDate
          }
        });
      } else {
        console.error(`[Subscription Sync ${requestId}] Error syncing subscription data:`, syncResult.error);
        
        return res.status(500).json({
          success: false,
          message: 'Failed to synchronize subscription data',
          error: syncResult.error
        });
      }
    } catch (authError: any) {
      console.error(`[Subscription Sync ${requestId}] Auth error:`, {
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
    console.error(`[Subscription Sync ${requestId}] Unhandled error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to synchronize subscription data',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}