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
  console.info(`[Subscription Cleanup ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
      // Initialize Firebase Admin and verify token
      const { admin } = getFirebaseAdmin();
      console.log(`[Subscription Cleanup ${requestId}] Firebase Admin initialized successfully`);
      
      // Verify the token and get user data
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Subscription Cleanup ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified
      });

      // Step 1: Check for existing Stripe customer by email
      let foundStripeCustomer = false;
      let foundStripeSubscription = false;
      let stripeCustomerId = null;
      let customerDeleted = false;
      
      if (userEmail) {
        try {
          console.log(`[Subscription Cleanup ${requestId}] Checking for existing Stripe customer by email:`, userEmail);
          const customers = await stripe.customers.list({
            email: userEmail,
            limit: 1
          });
          
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
            foundStripeCustomer = true;
            
            console.log(`[Subscription Cleanup ${requestId}] Found existing Stripe customer:`, {
              email: userEmail,
              customerId: stripeCustomerId
            });
            
            // Check if this customer has any subscriptions
            const subscriptions = await stripe.subscriptions.list({
              customer: stripeCustomerId,
              limit: 10
            });
            
            if (subscriptions.data.length > 0) {
              foundStripeSubscription = true;
              console.log(`[Subscription Cleanup ${requestId}] Found subscriptions for customer:`, {
                count: subscriptions.data.length,
                statuses: subscriptions.data.map(sub => sub.status)
              });
              
              // Cancel all existing subscriptions
              for (const subscription of subscriptions.data) {
                if (subscription.status !== 'canceled') {
                  await stripe.subscriptions.cancel(subscription.id);
                  console.log(`[Subscription Cleanup ${requestId}] Canceled subscription:`, subscription.id);
                } else {
                  console.log(`[Subscription Cleanup ${requestId}] Subscription already canceled:`, subscription.id);
                }
              }
            }
            
            // Always try to delete the customer for users who recreated accounts
            try {
              await stripe.customers.del(stripeCustomerId);
              console.log(`[Subscription Cleanup ${requestId}] Deleted Stripe customer:`, stripeCustomerId);
              customerDeleted = true;
            } catch (deleteError) {
              console.error(`[Subscription Cleanup ${requestId}] Error deleting customer:`, deleteError);
              // Continue with cleanup even if customer deletion fails
            }
          } else {
            console.log(`[Subscription Cleanup ${requestId}] No existing Stripe customer found for email:`, userEmail);
          }
        } catch (stripeError) {
          console.error(`[Subscription Cleanup ${requestId}] Error checking for Stripe customer:`, stripeError);
          // Continue with cleanup even if Stripe check fails
        }
      }
      
      // Step 2: Clean up subscription data in Firebase
      try {
        // Get Firestore and Realtime Database references
        const firestore = admin.firestore();
        const realtimeDb = admin.database();
        
        // Check current subscription data in Firestore
        const userDoc = await firestore.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        console.log(`[Subscription Cleanup ${requestId}] Current Firestore data:`, {
          exists: userDoc.exists,
          accountTier: userData?.accountTier || 'unknown',
          subscriptionStatus: userData?.subscription?.status || 'unknown'
        });
        
        // Check current subscription data in Realtime Database
        const rtdbSnapshot = await realtimeDb.ref(`users/${userId}/account`).once('value');
        const rtdbData = rtdbSnapshot.exists() ? rtdbSnapshot.val() : null;
        
        console.log(`[Subscription Cleanup ${requestId}] Current Realtime DB data:`, {
          exists: rtdbSnapshot.exists(),
          tier: rtdbData?.tier || 'unknown',
          subscriptionStatus: rtdbData?.subscription?.status || 'unknown'
        });
        
        // Reset subscription data to free tier
        const resetSubscription = {
          accountTier: 'free',
          tier: 'free',
          currentPlan: 'free',
          status: 'none',
          stripeSubscriptionId: null,
          startDate: new Date().toISOString(),
          endDate: null,
          renewalDate: null,
          cancelAtPeriodEnd: false,
          lastUpdated: Date.now()
        };
        
        // Sync the reset data to both databases
        await syncSubscriptionData(userId, resetSubscription);
        
        console.log(`[Subscription Cleanup ${requestId}] Reset subscription data for user:`, userId);
      } catch (dbError) {
        console.error(`[Subscription Cleanup ${requestId}] Error resetting subscription data:`, dbError);
        return res.status(500).json({
          success: false,
          message: 'Failed to reset subscription data in database',
          error: dbError.message
        });
      }
      
      // Return success response with details
      return res.status(200).json({
        success: true,
        message: 'Subscription data cleaned up successfully',
        details: {
          foundStripeCustomer,
          foundStripeSubscription,
          customerDeleted,
          dataReset: true
        }
      });

    } catch (authError: any) {
      console.error(`[Subscription Cleanup ${requestId}] Auth error:`, {
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
    console.error(`[Subscription Cleanup ${requestId}] Unhandled error:`, {
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