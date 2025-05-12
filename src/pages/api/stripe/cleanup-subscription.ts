import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { syncSubscriptionData } from '@/lib/subscription-sync';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  maxNetworkRetries: 3,
  timeout: 20000
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Subscription Cleanup ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'POST') {
    console.warn(`[Subscription Cleanup ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Subscription Cleanup ${requestId}] Missing or invalid authorization header`);
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
      console.log(`[Subscription Cleanup ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      const decodedToken = await auth.verifyIdToken(idToken, true);
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Subscription Cleanup ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified
      });

      if (!userEmail) {
        console.error('[Subscription Cleanup] No user email found for user:', userId);
        return res.status(400).json({ 
          error: 'Missing email',
          message: 'User email is required for subscription cleanup',
          code: 'EMAIL_MISSING'
        });
      }

      // Step 1: Check for existing customer in Stripe by email
      console.log('[Subscription Cleanup] Checking for existing Stripe customer by email:', userEmail);
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 5 // Check multiple customers in case there are duplicates
      });
      
      let foundStripeSubscription = false;
      let activeStripeSubscription = null;
      let stripeCustomerId = null;
      let stripeCustomers = [];
      
      if (customers.data.length > 0) {
        stripeCustomers = customers.data;
        console.log('[Subscription Cleanup] Found Stripe customers:', {
          count: customers.data.length,
          customerIds: customers.data.map(c => c.id)
        });
        
        // Check each customer for subscriptions
        for (const customer of customers.data) {
          stripeCustomerId = customer.id;
          
          // Check if this customer has any subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            limit: 10
          });
          
          if (subscriptions.data.length > 0) {
            console.log('[Subscription Cleanup] Found subscriptions for customer:', {
              customerId: stripeCustomerId,
              count: subscriptions.data.length,
              subscriptionIds: subscriptions.data.map(sub => sub.id),
              statuses: subscriptions.data.map(sub => sub.status)
            });
            
            foundStripeSubscription = true;
            
            // Find active subscription if any
            const activeSubscription = subscriptions.data.find(sub => 
              sub.status === 'active' || sub.status === 'trialing'
            );
            
            if (activeSubscription) {
              activeStripeSubscription = activeSubscription;
              console.log('[Subscription Cleanup] Found active subscription:', {
                subscriptionId: activeSubscription.id,
                status: activeSubscription.status
              });
              break; // Stop searching once we find an active subscription
            }
            
            // If no active subscription found, use the first one for reference
            if (!activeStripeSubscription && subscriptions.data.length > 0) {
              activeStripeSubscription = subscriptions.data[0];
            }
          }
        }
      } else {
        console.log('[Subscription Cleanup] No Stripe customers found for email:', userEmail);
      }

      // Step 2: Check our database for subscription data
      const db = firebaseAdmin.database();
      const firestore = firebaseAdmin.firestore();
      
      // Check Realtime Database
      const userRef = db.ref(`users/${userId}/account/subscription`);
      const snapshot = await userRef.once('value');
      const currentSubscription = snapshot.val();

      // Check Firestore
      const userDoc = await firestore.collection('users').doc(userId).get();
      const firestoreData = userDoc.exists ? userDoc.data() : null;
      
      console.log('[Subscription Cleanup] Current subscription data:', {
        realtimeDb: currentSubscription || 'none',
        firestore: firestoreData?.subscription || 'none'
      });

      // Step 3: Determine the correct subscription state
      let subscriptionData: any = {
        status: 'none',
        stripeSubscriptionId: null,
        tier: 'free',
        currentPlan: 'free',
        lastUpdated: Date.now()
      };
      
      // If we found an active subscription in Stripe, use that as the source of truth
      if (activeStripeSubscription && activeStripeSubscription.status === 'active') {
        console.log('[Subscription Cleanup] Using active Stripe subscription as source of truth');
        
        const currentPeriodEnd = new Date(activeStripeSubscription.current_period_end * 1000);
        const currentPeriodStart = new Date(activeStripeSubscription.current_period_start * 1000);
        
        subscriptionData = {
          status: 'active',
          stripeSubscriptionId: activeStripeSubscription.id,
          startDate: currentPeriodStart.toISOString(),
          endDate: currentPeriodEnd.toISOString(),
          renewalDate: currentPeriodEnd.toISOString(),
          currentPeriodEnd: activeStripeSubscription.current_period_end,
          cancelAtPeriodEnd: activeStripeSubscription.cancel_at_period_end,
          canceledAt: activeStripeSubscription.canceled_at ? new Date(activeStripeSubscription.canceled_at * 1000).toISOString() : null,
          tier: 'premium',
          currentPlan: 'premium'
        };
      }
      // If we found a canceled subscription in Stripe that's still within its paid period
      else if (activeStripeSubscription && activeStripeSubscription.status === 'canceled') {
        const endDate = new Date(activeStripeSubscription.current_period_end * 1000);
        const now = new Date();
        
        if (endDate > now) {
          console.log('[Subscription Cleanup] Using canceled but active Stripe subscription');
          
          subscriptionData = {
            status: 'canceled',
            stripeSubscriptionId: activeStripeSubscription.id,
            startDate: new Date(activeStripeSubscription.current_period_start * 1000).toISOString(),
            endDate: endDate.toISOString(),
            renewalDate: endDate.toISOString(), // For canceled subscriptions, renewal date is same as end date
            currentPeriodEnd: activeStripeSubscription.current_period_end,
            cancelAtPeriodEnd: true,
            canceledAt: activeStripeSubscription.canceled_at ? new Date(activeStripeSubscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
            tier: 'premium', // Still premium until the end date
            currentPlan: 'premium'
          };
        } else {
          console.log('[Subscription Cleanup] Found expired canceled subscription');
          // The subscription is expired, so we'll set to free tier
        }
      }
      // If we found subscriptions in Stripe but they're all expired or invalid
      else if (foundStripeSubscription) {
        console.log('[Subscription Cleanup] Found Stripe subscriptions but none are active');
        
        // Cancel all existing subscriptions to be safe
        for (const customer of stripeCustomers) {
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              limit: 10
            });
            
            for (const subscription of subscriptions.data) {
              if (subscription.status !== 'canceled') {
                await stripe.subscriptions.cancel(subscription.id);
                console.log('[Subscription Cleanup] Canceled subscription:', subscription.id);
              }
            }
          } catch (error) {
            console.error('[Subscription Cleanup] Error canceling subscriptions:', error);
          }
        }
      }
      // If there's an admin-assigned subscription in our database, preserve it
      else if ((currentSubscription?.stripeSubscriptionId?.startsWith('admin_') || 
                firestoreData?.subscription?.stripeSubscriptionId?.startsWith('admin_')) &&
               (currentSubscription?.status === 'active' || firestoreData?.subscription?.status === 'active')) {
        
        console.log('[Subscription Cleanup] Preserving admin-assigned subscription');
        
        // Use the admin subscription data from whichever database has it
        const adminSubData = currentSubscription?.stripeSubscriptionId?.startsWith('admin_') 
          ? currentSubscription 
          : firestoreData?.subscription;
        
        // Ensure we have proper dates for the admin subscription
        const currentDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(currentDate.getFullYear() + 1); // Set end date to 1 year from now
        
        subscriptionData = {
          status: 'active',
          stripeSubscriptionId: adminSubData.stripeSubscriptionId,
          startDate: adminSubData.startDate || currentDate.toISOString(),
          endDate: adminSubData.endDate || endDate.toISOString(),
          renewalDate: adminSubData.renewalDate || endDate.toISOString(),
          tier: 'premium',
          currentPlan: 'premium',
          manuallyUpdated: true,
          lastManualUpdate: currentDate.toISOString()
        };
      }
      
      // Step 4: Sync the subscription data to both databases
      console.log('[Subscription Cleanup] Syncing subscription data:', {
        status: subscriptionData.status,
        tier: subscriptionData.tier,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId
      });
      
      const syncResult = await syncSubscriptionData(userId, subscriptionData);
      
      if (syncResult.success) {
        console.log('[Subscription Cleanup] Subscription data synced successfully');
        
        // Step 5: If we found Stripe customers but no active subscriptions, clean them up
        if (foundStripeSubscription && subscriptionData.status === 'none') {
          console.log('[Subscription Cleanup] Cleaning up Stripe customers with no active subscriptions');
          
          // Delete all customers to allow for a fresh start
          for (const customer of stripeCustomers) {
            try {
              await stripe.customers.del(customer.id);
              console.log('[Subscription Cleanup] Deleted Stripe customer:', customer.id);
            } catch (error) {
              console.error('[Subscription Cleanup] Error deleting customer:', error);
            }
          }
        }
        
        return res.status(200).json({
          success: true,
          message: 'Subscription data cleaned up successfully',
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
        console.error('[Subscription Cleanup] Error syncing subscription data:', syncResult.error);
        
        return res.status(500).json({
          success: false,
          message: 'Failed to clean up subscription data',
          error: syncResult.error
        });
      }
    } catch (authError: any) {
      console.error('[Subscription Cleanup] Auth error:', {
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
    console.error('[Subscription Cleanup] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to clean up subscription data',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}