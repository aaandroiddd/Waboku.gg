import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { syncSubscriptionData } from '@/lib/subscription-sync';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Ensure this endpoint is only accessible with the admin secret
  const adminSecret = req.headers['x-admin-secret'] || req.query.adminSecret;
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('Unauthorized access attempt to fix-subscription-downgrades');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();
    const realtimeDb = getDatabase();

    // Get users with potential subscription issues
    const { userId } = req.body;

    if (userId) {
      // Fix a specific user
      console.log(`[Fix Subscription] Fixing subscription for specific user: ${userId}`);
      const result = await fixUserSubscription(userId, firestoreDb, realtimeDb);
      return res.status(200).json(result);
    } else {
      // Find and fix all users with inconsistent subscription data
      console.log('[Fix Subscription] Scanning for users with inconsistent subscription data');
      const results = await findAndFixInconsistentSubscriptions(firestoreDb, realtimeDb);
      return res.status(200).json(results);
    }
  } catch (error: any) {
    console.error('[Fix Subscription] Error:', error);
    return res.status(500).json({
      error: 'Failed to fix subscription downgrades',
      message: error.message
    });
  }
}

async function fixUserSubscription(userId: string, firestoreDb: FirebaseFirestore.Firestore, realtimeDb: any) {
  console.log(`[Fix Subscription] Checking user ${userId}`);
  
  // Get data from both databases
  const firestoreDoc = await firestoreDb.collection('users').doc(userId).get();
  const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : null;
  
  const realtimeSnapshot = await realtimeDb.ref(`users/${userId}/account`).once('value');
  const realtimeData = realtimeSnapshot.exists() ? realtimeSnapshot.val() : null;
  
  if (!firestoreData && !realtimeData) {
    return { 
      userId, 
      status: 'not_found',
      message: 'User not found in either database'
    };
  }
  
  // Check for inconsistencies
  const firestoreTier = firestoreData?.accountTier || 'free';
  const realtimeTier = realtimeData?.tier || 'free';
  
  const firestoreStatus = firestoreData?.subscription?.status || 'none';
  const realtimeStatus = realtimeData?.subscription?.status || 'none';
  
  const firestoreSubId = firestoreData?.subscription?.stripeSubscriptionId;
  const realtimeSubId = realtimeData?.subscription?.stripeSubscriptionId;
  
  // Check if subscription should be active based on dates
  const now = new Date();
  const firestoreEndDate = firestoreData?.subscription?.endDate ? new Date(firestoreData.subscription.endDate) : null;
  const realtimeEndDate = realtimeData?.subscription?.endDate ? new Date(realtimeData.subscription.endDate) : null;
  
  const firestoreShouldBeActive = firestoreEndDate && now < firestoreEndDate;
  const realtimeShouldBeActive = realtimeEndDate && now < realtimeEndDate;
  
  // Determine if there's an inconsistency
  const hasInconsistency = 
    // Tier mismatch between databases
    firestoreTier !== realtimeTier ||
    // Status mismatch between databases
    firestoreStatus !== realtimeStatus ||
    // Subscription ID mismatch
    firestoreSubId !== realtimeSubId ||
    // Premium tier but inactive status
    (firestoreTier === 'premium' && firestoreStatus !== 'active' && firestoreShouldBeActive) ||
    (realtimeTier === 'premium' && realtimeStatus !== 'active' && realtimeShouldBeActive) ||
    // Free tier but has active dates
    (firestoreTier === 'free' && firestoreShouldBeActive) ||
    (realtimeTier === 'free' && realtimeShouldBeActive);
  
  if (!hasInconsistency) {
    return { 
      userId, 
      status: 'consistent',
      message: 'Subscription data is consistent'
    };
  }
  
  // Determine the correct subscription state
  // Prioritize data that indicates an active premium subscription
  const shouldBePremium = 
    (firestoreTier === 'premium' && firestoreShouldBeActive) ||
    (realtimeTier === 'premium' && realtimeShouldBeActive) ||
    (firestoreSubId && firestoreShouldBeActive) ||
    (realtimeSubId && realtimeShouldBeActive);
  
  // If canceled but still within paid period, keep as premium
  const isCanceledButActive =
    ((firestoreStatus === 'canceled' || realtimeStatus === 'canceled') && 
     (firestoreShouldBeActive || realtimeShouldBeActive));
  
  // Combine data from both sources, prioritizing the most favorable state for the user
  const combinedData = {
    tier: shouldBePremium ? 'premium' : 'free',
    currentPlan: shouldBePremium ? 'premium' : 'free',
    status: isCanceledButActive ? 'canceled' : (shouldBePremium ? 'active' : 'none'),
    stripeSubscriptionId: firestoreSubId || realtimeSubId,
    startDate: firestoreData?.subscription?.startDate || realtimeData?.subscription?.startDate,
    endDate: firestoreData?.subscription?.endDate || realtimeData?.subscription?.endDate,
    renewalDate: firestoreData?.subscription?.renewalDate || realtimeData?.subscription?.endDate,
    currentPeriodEnd: realtimeData?.subscription?.currentPeriodEnd,
    cancelAtPeriodEnd: firestoreData?.subscription?.cancelAtPeriodEnd || realtimeData?.subscription?.cancelAtPeriodEnd,
    canceledAt: firestoreData?.subscription?.canceledAt || realtimeData?.subscription?.canceledAt,
    manuallyUpdated: true,
    lastManualUpdate: new Date().toISOString()
  };
  
  // Sync the corrected data to both databases
  await syncSubscriptionData(userId, combinedData);
  
  return {
    userId,
    status: 'fixed',
    message: 'Subscription data has been corrected',
    before: {
      firestore: {
        tier: firestoreTier,
        status: firestoreStatus,
        endDate: firestoreData?.subscription?.endDate
      },
      realtime: {
        tier: realtimeTier,
        status: realtimeStatus,
        endDate: realtimeData?.subscription?.endDate
      }
    },
    after: combinedData
  };
}

async function findAndFixInconsistentSubscriptions(firestoreDb: FirebaseFirestore.Firestore, realtimeDb: any) {
  // Get all users with subscription data
  const firestoreUsers = await firestoreDb.collection('users')
    .where('subscription.status', '!=', 'none')
    .limit(100)
    .get();
  
  console.log(`[Fix Subscription] Found ${firestoreUsers.size} users with subscription data in Firestore`);
  
  const results = {
    total: firestoreUsers.size,
    fixed: 0,
    consistent: 0,
    errors: 0,
    details: [] as any[]
  };
  
  // Process each user
  for (const doc of firestoreUsers.docs) {
    try {
      const userId = doc.id;
      const result = await fixUserSubscription(userId, firestoreDb, realtimeDb);
      
      results.details.push(result);
      
      if (result.status === 'fixed') {
        results.fixed++;
      } else if (result.status === 'consistent') {
        results.consistent++;
      }
    } catch (error) {
      console.error('[Fix Subscription] Error processing user:', error);
      results.errors++;
    }
  }
  
  return results;
}