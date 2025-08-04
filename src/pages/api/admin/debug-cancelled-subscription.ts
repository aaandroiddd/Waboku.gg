import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const authResult = await verifyAuthToken(req);
    if (!authResult.success || !authResult.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has admin privileges
    const userRecord = await getFirebaseAdmin().auth.getUser(authResult.user.uid);
    const customClaims = userRecord.customClaims || {};
    
    if (!customClaims.admin && !customClaims.moderator) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const { userId, email } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ error: 'Either userId or email is required' });
    }

    const { db } = getFirebaseAdmin();
    let userDoc;
    let actualUserId = userId;

    // If email is provided, find the user by email
    if (email && !userId) {
      const usersSnapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        return res.status(404).json({ error: 'User not found with that email' });
      }

      userDoc = usersSnapshot.docs[0];
      actualUserId = userDoc.id;
    } else {
      // Get user by ID
      userDoc = await db.collection('users').doc(actualUserId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const userData = userDoc.data();
    if (!userData) {
      return res.status(404).json({ error: 'User data not found' });
    }

    const subscription = userData.subscription || {};
    const accountTier = userData.accountTier || 'free';

    // Calculate if user should have premium access
    const now = new Date();
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const renewalDate = subscription.renewalDate ? new Date(subscription.renewalDate) : null;
    const canceledAt = subscription.canceledAt ? new Date(subscription.canceledAt) : null;

    let shouldBePremium = false;
    let reason = '';
    let daysRemaining = 0;
    let isWithinPaidPeriod = false;

    // Check if subscription is active
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      shouldBePremium = true;
      reason = `Subscription is ${subscription.status}`;
      
      if (endDate) {
        daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isWithinPaidPeriod = now < endDate;
      }
    }
    // Check if subscription is canceled but still within paid period
    else if (subscription.status === 'canceled') {
      if (endDate && now < endDate) {
        shouldBePremium = true;
        reason = 'Subscription is canceled but still within paid period';
        daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isWithinPaidPeriod = true;
      } else if (renewalDate && now < renewalDate) {
        shouldBePremium = true;
        reason = 'Subscription is canceled but still within renewal period';
        daysRemaining = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isWithinPaidPeriod = true;
      } else {
        reason = 'Subscription is canceled and past the paid period';
        if (endDate) {
          daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    }
    // Check for admin-assigned subscriptions
    else if (subscription.stripeSubscriptionId?.startsWith('admin_')) {
      shouldBePremium = true;
      reason = 'Admin-assigned premium subscription';
      daysRemaining = 365; // Admin subscriptions typically don't expire
      isWithinPaidPeriod = true;
    }
    // Check for manually updated premium
    else if (subscription.manuallyUpdated && subscription.currentPlan === 'premium') {
      shouldBePremium = true;
      reason = 'Manually updated to premium';
      daysRemaining = 365; // Manual updates typically don't expire
      isWithinPaidPeriod = true;
    }
    else {
      reason = `Subscription status is '${subscription.status || 'none'}' with no valid premium indicators`;
    }

    const response = {
      userId: actualUserId,
      email: userData.email || 'Not set',
      displayName: userData.displayName || userData.username || 'Not set',
      accountTier,
      subscription: {
        status: subscription.status || 'none',
        stripeSubscriptionId: subscription.stripeSubscriptionId || 'Not set',
        startDate: subscription.startDate || 'Not set',
        endDate: subscription.endDate || 'Not set',
        renewalDate: subscription.renewalDate || 'Not set',
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        canceledAt: subscription.canceledAt || 'Not canceled',
        currentPlan: subscription.currentPlan || 'free',
      },
      calculatedStatus: {
        shouldBePremium,
        reason,
        daysRemaining,
        isWithinPaidPeriod,
      },
    };

    console.log('[Debug Cancelled Subscription] Analysis completed:', {
      userId: actualUserId,
      accountTier,
      subscriptionStatus: subscription.status,
      shouldBePremium,
      reason,
      daysRemaining,
      isWithinPaidPeriod,
    });

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[Debug Cancelled Subscription] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}