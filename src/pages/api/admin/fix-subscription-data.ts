import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { syncSubscriptionData } from '@/lib/subscription-sync';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`[Subscription Fix] Starting fixes for user: ${userId}`);

    // Initialize Firebase Admin
    const { admin } = getFirebaseAdmin();
    const firestore = admin.firestore();
    const realtimeDb = admin.database();

    const fixesApplied: string[] = [];
    const remainingIssues: string[] = [];

    // Get current data
    const firestoreDoc = await firestore.collection('users').doc(userId).get();
    const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : null;

    const realtimeSnapshot = await realtimeDb.ref(`users/${userId}/account`).once('value');
    const realtimeData = realtimeSnapshot.exists() ? realtimeSnapshot.val() : null;

    // Get user email for Stripe lookup
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    // Get Stripe data
    let stripeSubscription: any = null;
    if (userEmail) {
      try {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1
        });

        if (customers.data.length > 0) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customers.data[0].id,
            limit: 1
          });

          if (subscriptions.data.length > 0) {
            stripeSubscription = subscriptions.data[0];
          }
        }
      } catch (stripeError) {
        console.error('[Subscription Fix] Stripe error:', stripeError);
      }
    }

    // Fix 1: Initialize missing user document
    if (!firestoreData) {
      await firestore.collection('users').doc(userId).set({
        accountTier: 'free',
        subscription: {
          status: 'none',
          currentPlan: 'free',
          stripeSubscriptionId: null,
          startDate: new Date().toISOString(),
          manuallyUpdated: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      fixesApplied.push('Initialized missing Firestore user document');
    }

    // Fix 2: Initialize missing Realtime Database data
    if (!realtimeData) {
      await realtimeDb.ref(`users/${userId}/account`).set({
        tier: 'free',
        status: 'active',
        lastUpdated: Date.now(),
        subscription: {
          status: 'none',
          tier: 'free',
          stripeSubscriptionId: null,
          lastUpdated: Date.now()
        }
      });
      fixesApplied.push('Initialized missing Realtime Database account data');
    }

    // Refresh data after initialization
    const updatedFirestoreDoc = await firestore.collection('users').doc(userId).get();
    const updatedFirestoreData = updatedFirestoreDoc.data();

    // Fix 3: Correct invalid dates
    const fixDate = (dateString: string | null | undefined): string | null => {
      if (!dateString) return null;
      
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return new Date().toISOString(); // Use current date as fallback
        }
        
        // Check for unrealistic future dates (more than 2 years)
        const twoYearsFromNow = new Date();
        twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
        
        if (date > twoYearsFromNow) {
          // If it's a subscription end date, set it to 1 month from now
          const oneMonthFromNow = new Date();
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          return oneMonthFromNow.toISOString();
        }
        
        return date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    let needsDateFix = false;
    const correctedSubscription = { ...updatedFirestoreData?.subscription };

    if (correctedSubscription.startDate) {
      const originalStart = correctedSubscription.startDate;
      correctedSubscription.startDate = fixDate(correctedSubscription.startDate);
      if (originalStart !== correctedSubscription.startDate) {
        needsDateFix = true;
      }
    }

    if (correctedSubscription.endDate) {
      const originalEnd = correctedSubscription.endDate;
      correctedSubscription.endDate = fixDate(correctedSubscription.endDate);
      if (originalEnd !== correctedSubscription.endDate) {
        needsDateFix = true;
      }
    }

    if (correctedSubscription.renewalDate) {
      const originalRenewal = correctedSubscription.renewalDate;
      correctedSubscription.renewalDate = fixDate(correctedSubscription.renewalDate);
      if (originalRenewal !== correctedSubscription.renewalDate) {
        needsDateFix = true;
      }
    }

    if (needsDateFix) {
      await firestore.collection('users').doc(userId).update({
        subscription: correctedSubscription,
        updatedAt: new Date()
      });
      fixesApplied.push('Corrected invalid subscription dates');
    }

    // Fix 4: Resolve canceled status with null subscription ID
    if (correctedSubscription.status === 'canceled' && !correctedSubscription.stripeSubscriptionId) {
      // If there's no Stripe subscription, this should be a free account
      const cleanSubscription = {
        status: 'none',
        currentPlan: 'free',
        stripeSubscriptionId: null,
        startDate: new Date().toISOString(),
        endDate: null,
        renewalDate: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        manuallyUpdated: false
      };

      await syncSubscriptionData(userId, cleanSubscription);
      fixesApplied.push('Cleared invalid canceled subscription status');
    }

    // Fix 5: Sync with Stripe if available
    if (stripeSubscription && updatedFirestoreData?.subscription?.stripeSubscriptionId === stripeSubscription.id) {
      const stripeBasedSubscription = {
        status: stripeSubscription.status,
        currentPlan: 'premium',
        tier: 'premium',
        stripeSubscriptionId: stripeSubscription.id,
        startDate: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        endDate: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        renewalDate: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        currentPeriodEnd: stripeSubscription.current_period_end,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null
      };

      await syncSubscriptionData(userId, stripeBasedSubscription);
      fixesApplied.push('Synchronized subscription data with Stripe');
    }

    // Fix 6: Resolve database inconsistencies
    const finalFirestoreDoc = await firestore.collection('users').doc(userId).get();
    const finalFirestoreData = finalFirestoreDoc.data();

    const finalRealtimeSnapshot = await realtimeDb.ref(`users/${userId}/account`).once('value');
    const finalRealtimeData = finalRealtimeSnapshot.exists() ? finalRealtimeSnapshot.val() : null;

    if (finalFirestoreData && finalRealtimeData) {
      let needsSync = false;

      if (finalFirestoreData.accountTier !== finalRealtimeData.tier) {
        needsSync = true;
      }

      if (finalFirestoreData.subscription?.status !== finalRealtimeData.subscription?.status) {
        needsSync = true;
      }

      if (needsSync) {
        await syncSubscriptionData(userId, finalFirestoreData.subscription);
        fixesApplied.push('Synchronized data between Firestore and Realtime Database');
      }
    }

    // Clear user caches
    try {
      // Clear localStorage cache keys that might exist
      const cacheKeys = [
        `account_data_${userId}`,
        `premium_status_${userId}`,
        `user_profile_${userId}`,
        `subscription_data_${userId}`
      ];

      // Note: We can't directly clear localStorage from server-side,
      // but we can recommend the user to clear their browser cache
      fixesApplied.push('Recommended browser cache clearing for user');
    } catch (cacheError) {
      console.error('[Subscription Fix] Cache clearing error:', cacheError);
    }

    // Check for remaining issues
    const finalCheck = await firestore.collection('users').doc(userId).get();
    const finalData = finalCheck.data();

    if (finalData?.subscription?.status === 'canceled' && !finalData.subscription.stripeSubscriptionId) {
      remainingIssues.push('Subscription still shows canceled status with no Stripe ID');
    }

    if (finalData?.accountTier === 'premium' && (!finalData.subscription?.stripeSubscriptionId || finalData.subscription?.status === 'none')) {
      remainingIssues.push('Account tier is premium but subscription data indicates no active subscription');
    }

    console.log(`[Subscription Fix] Completed fixes for user ${userId}: ${fixesApplied.length} fixes applied, ${remainingIssues.length} issues remaining`);

    return res.status(200).json({
      userId,
      fixesApplied,
      remainingIssues,
      success: true
    });
  } catch (error: any) {
    console.error('[Subscription Fix] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}