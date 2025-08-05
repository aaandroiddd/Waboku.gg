import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
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

    console.log(`[Subscription Diagnostic] Starting diagnostic for user: ${userId}`);

    // Initialize Firebase Admin
    const { admin } = getFirebaseAdmin();
    const firestore = admin.firestore();
    const realtimeDb = admin.database();

    // Get Firestore data
    const firestoreDoc = await firestore.collection('users').doc(userId).get();
    const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : null;

    // Get Realtime Database data
    const realtimeSnapshot = await realtimeDb.ref(`users/${userId}/account`).once('value');
    const realtimeData = realtimeSnapshot.exists() ? realtimeSnapshot.val() : null;

    // Get user email for Stripe lookup
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    // Get Stripe data
    let stripeData: any = null;
    if (userEmail) {
      try {
        // Look for customer by email
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          stripeData = {
            customerId: customer.id,
            email: customer.email,
            created: customer.created
          };

          // Get subscriptions for this customer
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 10
          });

          if (subscriptions.data.length > 0) {
            stripeData.subscriptions = subscriptions.data;
            stripeData.subscription = subscriptions.data[0]; // Most recent
            stripeData.status = subscriptions.data[0].status;
          }
        }
      } catch (stripeError) {
        console.error('[Subscription Diagnostic] Stripe error:', stripeError);
        stripeData = { error: 'Failed to fetch Stripe data' };
      }
    }

    // Analyze issues
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for invalid dates
    const checkDate = (dateString: string | null | undefined, fieldName: string) => {
      if (!dateString) return null;
      
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          issues.push(`Invalid date in ${fieldName}: ${dateString}`);
          return null;
        }
        
        // Check for future dates that seem unrealistic (more than 2 years in future)
        const twoYearsFromNow = new Date();
        twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
        
        if (date > twoYearsFromNow) {
          issues.push(`Unrealistic future date in ${fieldName}: ${dateString} (${date.toLocaleDateString()})`);
        }
        
        return date;
      } catch {
        issues.push(`Invalid date format in ${fieldName}: ${dateString}`);
        return null;
      }
    };

    // Check Firestore dates
    if (firestoreData?.subscription) {
      checkDate(firestoreData.subscription.startDate, 'Firestore startDate');
      checkDate(firestoreData.subscription.endDate, 'Firestore endDate');
      checkDate(firestoreData.subscription.renewalDate, 'Firestore renewalDate');
      checkDate(firestoreData.subscription.canceledAt, 'Firestore canceledAt');
    }

    // Check Realtime Database dates
    if (realtimeData?.subscription) {
      checkDate(realtimeData.subscription.startDate, 'Realtime Database startDate');
      checkDate(realtimeData.subscription.endDate, 'Realtime Database endDate');
      checkDate(realtimeData.subscription.renewalDate, 'Realtime Database renewalDate');
    }

    // Check for data inconsistencies between databases
    if (firestoreData && realtimeData) {
      if (firestoreData.accountTier !== realtimeData.tier) {
        issues.push(`Account tier mismatch: Firestore shows "${firestoreData.accountTier}", Realtime DB shows "${realtimeData.tier}"`);
      }

      if (firestoreData.subscription?.status !== realtimeData.subscription?.status) {
        issues.push(`Subscription status mismatch: Firestore shows "${firestoreData.subscription?.status}", Realtime DB shows "${realtimeData.subscription?.status}"`);
      }

      if (firestoreData.subscription?.stripeSubscriptionId !== realtimeData.subscription?.stripeSubscriptionId) {
        issues.push(`Stripe subscription ID mismatch between databases`);
      }
    }

    // Check for inconsistent subscription state
    if (firestoreData?.subscription) {
      const sub = firestoreData.subscription;
      
      // Check for canceled status with null subscription ID
      if (sub.status === 'canceled' && !sub.stripeSubscriptionId) {
        issues.push('Subscription marked as canceled but has no Stripe subscription ID');
        recommendations.push('Clear canceled status or restore proper subscription ID');
      }

      // Check for premium tier with no subscription
      if (firestoreData.accountTier === 'premium' && (!sub.stripeSubscriptionId || sub.status === 'none')) {
        issues.push('Account tier is premium but subscription data indicates no active subscription');
        recommendations.push('Verify if this should be a free account or if subscription data is missing');
      }

      // Check for active subscription with past end date
      if (sub.status === 'active' && sub.endDate) {
        const endDate = new Date(sub.endDate);
        if (!isNaN(endDate.getTime()) && endDate < new Date()) {
          issues.push('Subscription marked as active but end date is in the past');
          recommendations.push('Update subscription status to reflect current state');
        }
      }
    }

    // Check Stripe data consistency
    if (stripeData?.subscription && firestoreData?.subscription) {
      const stripeStatus = stripeData.subscription.status;
      const firestoreStatus = firestoreData.subscription.status;
      
      if (stripeStatus !== firestoreStatus && !(stripeStatus === 'active' && firestoreStatus === 'canceled')) {
        issues.push(`Stripe subscription status (${stripeStatus}) doesn't match Firestore status (${firestoreStatus})`);
        recommendations.push('Sync subscription status with Stripe');
      }
    }

    // Check for missing data
    if (!firestoreData) {
      issues.push('No Firestore data found for user');
      recommendations.push('Initialize user document in Firestore');
    }

    if (!realtimeData) {
      issues.push('No Realtime Database data found for user');
      recommendations.push('Initialize user account data in Realtime Database');
    }

    // Cache-related recommendations
    if (issues.length > 0) {
      recommendations.push('Clear user caches after fixing data inconsistencies');
      recommendations.push('User should sign out and sign back in to refresh client-side data');
    }

    const result = {
      userId,
      issues,
      firestoreData,
      realtimeData,
      stripeData,
      recommendations,
      fixesApplied: []
    };

    console.log(`[Subscription Diagnostic] Completed diagnostic for user ${userId}: ${issues.length} issues found`);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[Subscription Diagnostic] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}