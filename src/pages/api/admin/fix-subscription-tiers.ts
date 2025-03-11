import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { syncSubscriptionData } from '@/lib/subscription-sync';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[Fix Subscription Tiers ${requestId}] Request received`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();
    const realtimeDb = getDatabase();

    // Get specific user if provided
    const { userId } = req.body;
    
    let usersSnapshot;
    if (userId) {
      console.log(`[Fix Subscription Tiers ${requestId}] Fixing specific user: ${userId}`);
      const userDoc = await firestoreDb.collection('users').doc(userId).get();
      usersSnapshot = { 
        docs: userDoc.exists ? [userDoc] : [],
        size: userDoc.exists ? 1 : 0
      };
    } else {
      // Get all users with potential issues
      console.log(`[Fix Subscription Tiers ${requestId}] Scanning all users for subscription tier issues`);
      usersSnapshot = await firestoreDb.collection('users').get();
    }
    
    console.log(`[Fix Subscription Tiers ${requestId}] Found ${usersSnapshot.size} users to process`);
    
    const fixedUsers: any[] = [];
    const skippedUsers: any[] = [];
    const errors: any[] = [];
    const now = new Date();

    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      const subscription = userData.subscription || {};
      
      try {
        // Determine correct tier based on subscription status and dates
        const isActivePremium = (
          subscription.currentPlan === 'premium' && (
            subscription.status === 'active' ||
            (subscription.status === 'canceled' && 
             subscription.endDate && 
             new Date(subscription.endDate) > now)
          )
        );

        const correctTier = isActivePremium ? 'premium' : 'free';
        const currentTier = userData.accountTier || 'free';

        // If there's a mismatch, fix it
        if (currentTier !== correctTier) {
          console.log(`[Fix Subscription Tiers ${requestId}] Fixing user ${userId}: ${currentTier} -> ${correctTier}`);
          
          // Update subscription data using our sync function
          const updatedSubscription = {
            ...subscription,
            tier: subscription.currentPlan, // Preserve the plan
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            renewalDate: subscription.endDate,
            currentPlan: subscription.currentPlan,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
            canceledAt: subscription.canceledAt || null
          };
          
          // Use our subscription sync function to update both databases
          const syncResult = await syncSubscriptionData(userId, updatedSubscription);
          
          if (syncResult.success) {
            fixedUsers.push({
              userId,
              oldTier: currentTier,
              newTier: correctTier,
              subscription: {
                status: subscription.status,
                currentPlan: subscription.currentPlan,
                endDate: subscription.endDate
              }
            });
          } else {
            errors.push({
              userId,
              error: syncResult.error,
              message: syncResult.message
            });
          }
        } else {
          skippedUsers.push({
            userId,
            tier: currentTier,
            reason: 'No mismatch detected'
          });
        }
      } catch (userError: any) {
        console.error(`[Fix Subscription Tiers ${requestId}] Error processing user ${userId}:`, userError);
        errors.push({
          userId,
          error: userError.message,
          stack: userError.stack
        });
      }
    }

    console.log(`[Fix Subscription Tiers ${requestId}] Completed: Fixed ${fixedUsers.length} users, skipped ${skippedUsers.length}, errors ${errors.length}`);

    return res.status(200).json({
      success: true,
      message: `Fixed ${fixedUsers.length} accounts with mismatched tiers`,
      fixedUsers,
      skippedUsers,
      errors,
      totalProcessed: usersSnapshot.size
    });

  } catch (error: any) {
    console.error(`[Fix Subscription Tiers ${requestId}] Error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
}