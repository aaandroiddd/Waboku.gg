import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';
import { syncSubscriptionData } from '@/lib/subscription-sync';

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

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { db } = getFirebaseAdmin();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    if (!userData) {
      return res.status(404).json({ error: 'User data not found' });
    }

    const subscription = userData.subscription || {};
    const now = new Date();
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const renewalDate = subscription.renewalDate ? new Date(subscription.renewalDate) : null;

    // Determine if user should have premium access
    let shouldBePremium = false;
    let fixReason = '';

    // Check if subscription is active
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      shouldBePremium = true;
      fixReason = `Subscription is ${subscription.status}`;
    }
    // Check if subscription is canceled but still within paid period
    else if (subscription.status === 'canceled') {
      if (endDate && now < endDate) {
        shouldBePremium = true;
        fixReason = 'Subscription is canceled but still within paid period';
      } else if (renewalDate && now < renewalDate) {
        shouldBePremium = true;
        fixReason = 'Subscription is canceled but still within renewal period';
      }
    }
    // Check for admin-assigned subscriptions
    else if (subscription.stripeSubscriptionId?.startsWith('admin_')) {
      shouldBePremium = true;
      fixReason = 'Admin-assigned premium subscription';
    }
    // Check for manually updated premium
    else if (subscription.manuallyUpdated && subscription.currentPlan === 'premium') {
      shouldBePremium = true;
      fixReason = 'Manually updated to premium';
    }

    if (!shouldBePremium) {
      return res.status(400).json({ 
        error: 'User should not have premium access based on current subscription data' 
      });
    }

    // Update the user's account tier to premium
    const updatedSubscription = {
      ...subscription,
      // Ensure we preserve the subscription status but set account tier correctly
      currentPlan: 'premium',
      tier: 'premium',
      // If it's a canceled subscription, make sure we preserve that status
      // but ensure the account tier reflects premium access until end date
    };

    // Update Firestore directly
    await db.collection('users').doc(userId).update({
      accountTier: 'premium',
      subscription: updatedSubscription,
      updatedAt: new Date(),
    });

    // Also sync to Realtime Database
    try {
      await syncSubscriptionData(userId, updatedSubscription);
    } catch (syncError) {
      console.error('[Fix Cancelled Subscription] Sync error:', syncError);
      // Continue even if sync fails - Firestore update was successful
    }

    console.log('[Fix Cancelled Subscription] Fixed subscription for user:', {
      userId,
      previousTier: userData.accountTier,
      newTier: 'premium',
      reason: fixReason,
      subscriptionStatus: subscription.status,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully updated account tier to premium. Reason: ${fixReason}`,
      previousTier: userData.accountTier,
      newTier: 'premium',
      fixReason,
    });

  } catch (error: any) {
    console.error('[Fix Cancelled Subscription] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}