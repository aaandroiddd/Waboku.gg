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

// Maximum number of users to process in a single batch
const BATCH_SIZE = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Account Tier Sync ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Verify that this is a cron job request from Vercel or an admin request
  const authHeader = req.headers.authorization;
  const isValidCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isValidAdminRequest = authHeader === `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`;
  
  if (!isValidCronRequest && !isValidAdminRequest) {
    console.warn(`[Account Tier Sync ${requestId}] Unauthorized access attempt`, {
      providedAuth: authHeader ? authHeader.substring(0, 15) + '...' : 'none',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    const { db } = getFirebaseAdmin();
    console.log(`[Account Tier Sync ${requestId}] Firebase Admin initialized successfully`);

    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    console.log(`[Account Tier Sync ${requestId}] Found ${totalUsers} users to process`);

    // Process users in batches
    let processedUsers = 0;
    let updatedUsers = 0;
    let failedUsers = 0;
    let skippedUsers = 0;
    
    // Process users in batches to avoid memory issues
    const userBatches = [];
    let currentBatch = [];
    
    usersSnapshot.forEach(doc => {
      currentBatch.push(doc);
      if (currentBatch.length >= BATCH_SIZE) {
        userBatches.push([...currentBatch]);
        currentBatch = [];
      }
    });
    
    // Add any remaining users to the last batch
    if (currentBatch.length > 0) {
      userBatches.push(currentBatch);
    }
    
    console.log(`[Account Tier Sync ${requestId}] Split users into ${userBatches.length} batches`);
    
    // Process each batch sequentially
    for (let batchIndex = 0; batchIndex < userBatches.length; batchIndex++) {
      const batch = userBatches[batchIndex];
      console.log(`[Account Tier Sync ${requestId}] Processing batch ${batchIndex + 1}/${userBatches.length} with ${batch.length} users`);
      
      // Process each user in the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (userDoc) => {
          const userId = userDoc.id;
          const userData = userDoc.data();
          
          try {
            // Skip users without email (can't check Stripe)
            if (!userData.email) {
              console.log(`[Account Tier Sync ${requestId}] Skipping user ${userId} - no email`);
              skippedUsers++;
              return { userId, status: 'skipped', reason: 'no_email' };
            }
            
            // Check if the user has a subscription in Stripe
            let stripeSubscription = null;
            let stripeCustomer = null;
            
            try {
              // First, find the customer by email
              const customers = await stripe.customers.list({
                email: userData.email,
                limit: 1
              });
              
              if (customers.data.length > 0) {
                stripeCustomer = customers.data[0];
                
                // Look for active subscriptions
                const subscriptions = await stripe.subscriptions.list({
                  customer: stripeCustomer.id,
                  status: 'active',
                  limit: 1
                });
                
                if (subscriptions.data.length > 0) {
                  stripeSubscription = subscriptions.data[0];
                } else {
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
                    }
                  }
                }
              }
            } catch (stripeError) {
              console.error(`[Account Tier Sync ${requestId}] Error checking Stripe for user ${userId}:`, stripeError);
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
              // No Stripe subscription found, check existing data
              if (userData.subscription?.stripeSubscriptionId) {
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
                } else {
                  // Regular subscription not found in Stripe, mark as inactive
                  subscriptionData = {
                    status: 'none',
                    stripeSubscriptionId: null,
                    tier: 'free',
                    currentPlan: 'free'
                  };
                }
              } else {
                // No subscription data
                subscriptionData = {
                  status: 'none',
                  stripeSubscriptionId: null,
                  tier: 'free',
                  currentPlan: 'free'
                };
              }
            }
            
            // Sync the subscription data
            const syncResult = await syncSubscriptionData(userId, subscriptionData);
            
            if (syncResult.success) {
              updatedUsers++;
              return { 
                userId, 
                status: 'updated', 
                accountTier: subscriptionData.tier || 'free',
                subscriptionStatus: subscriptionData.status || 'none'
              };
            } else {
              failedUsers++;
              return { 
                userId, 
                status: 'failed', 
                error: syncResult.error 
              };
            }
          } catch (error: any) {
            console.error(`[Account Tier Sync ${requestId}] Error processing user ${userId}:`, error);
            failedUsers++;
            return { 
              userId, 
              status: 'failed', 
              error: error.message 
            };
          } finally {
            processedUsers++;
          }
        })
      );
      
      // Log batch completion
      console.log(`[Account Tier Sync ${requestId}] Completed batch ${batchIndex + 1}/${userBatches.length}`, {
        batchSize: batch.length,
        successful: batchResults.filter(r => r.status === 'fulfilled').length,
        failed: batchResults.filter(r => r.status === 'rejected').length
      });
      
      // Add a small delay between batches to avoid rate limits
      if (batchIndex < userBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Log completion
    console.log(`[Account Tier Sync ${requestId}] Completed sync process`, {
      totalUsers,
      processedUsers,
      updatedUsers,
      failedUsers,
      skippedUsers
    });
    
    return res.status(200).json({
      success: true,
      message: 'Account tier sync completed',
      stats: {
        totalUsers,
        processedUsers,
        updatedUsers,
        failedUsers,
        skippedUsers
      }
    });
  } catch (error: any) {
    console.error(`[Account Tier Sync ${requestId}] Unhandled error:`, {
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}