import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('Invalid admin secret provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const admin = getFirebaseAdmin();
    const { db: realtimeDb } = getFirebaseServices();

    // Get all users
    const usersSnapshot = await get(ref(realtimeDb, 'users'));
    const users = usersSnapshot.val();

    const inconsistencies = [];

    for (const [userId, userData] of Object.entries(users)) {
      const account = (userData as any).account;
      if (!account) continue;

      const now = new Date();
      const subscription = account.subscription || {};
      const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
      const startDate = subscription.startDate ? new Date(subscription.startDate) : null;

      // Calculate expected tier based on subscription status
      const shouldBePremium = (
        subscription.status === 'active' ||
        (subscription.status === 'canceled' && endDate && endDate > now) ||
        (subscription.stripeSubscriptionId && startDate && startDate <= now)
      );

      const expectedTier = shouldBePremium ? 'premium' : 'free';
      const actualTier = account.tier || 'free';

      // Check for inconsistencies
      if (expectedTier !== actualTier) {
        inconsistencies.push({
          userId,
          actualTier,
          expectedTier,
          subscription: {
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            startDate: subscription.startDate,
            endDate: subscription.endDate
          },
          reason: getInconsistencyReason(subscription, actualTier, expectedTier)
        });
      }

      // Check for invalid subscription states
      if (subscription.status === 'active' && (!subscription.stripeSubscriptionId || !startDate)) {
        inconsistencies.push({
          userId,
          actualTier,
          expectedTier: 'free',
          subscription: {
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            startDate: subscription.startDate,
            endDate: subscription.endDate
          },
          reason: 'Active subscription missing required data'
        });
      }

      // Check for expired canceled subscriptions still marked as premium
      if (
        subscription.status === 'canceled' &&
        endDate &&
        endDate <= now &&
        actualTier === 'premium'
      ) {
        inconsistencies.push({
          userId,
          actualTier,
          expectedTier: 'free',
          subscription: {
            status: subscription.status,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            startDate: subscription.startDate,
            endDate: subscription.endDate
          },
          reason: 'Expired canceled subscription still marked as premium'
        });
      }
    }

    // Log the findings
    console.log('Account status check completed', {
      totalUsers: Object.keys(users || {}).length,
      inconsistenciesFound: inconsistencies.length,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      totalUsers: Object.keys(users || {}).length,
      inconsistenciesFound: inconsistencies.length,
      inconsistencies
    });

  } catch (error: any) {
    console.error('Error checking account status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

function getInconsistencyReason(
  subscription: any,
  actualTier: string,
  expectedTier: string
): string {
  if (subscription.status === 'active' && actualTier === 'free') {
    return 'Active subscription but account marked as free';
  }
  if (subscription.status === 'none' && actualTier === 'premium') {
    return 'No subscription but account marked as premium';
  }
  if (subscription.status === 'canceled' && actualTier === 'premium') {
    return 'Canceled subscription but account still premium';
  }
  return `Account tier mismatch: expected ${expectedTier} but found ${actualTier}`;
}