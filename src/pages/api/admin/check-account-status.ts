import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin secret
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Invalid admin secret' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const admin = getFirebaseAdmin();

    // Get user data from Realtime Database
    const userSnapshot = await admin.rtdb.ref(`users/${userId}`).get();
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get subscription data if exists
    const subscriptionSnapshot = await admin.rtdb.ref(`users/${userId}/account/subscription`).get();
    const subscription = subscriptionSnapshot.exists() ? subscriptionSnapshot.val() : null;

    // Get account tier
    const accountTierSnapshot = await admin.rtdb.ref(`users/${userId}/account/tier`).get();
    const accountTier = accountTierSnapshot.exists() ? accountTierSnapshot.val() : 'free';

    return res.status(200).json({
      userId,
      accountTier,
      subscription,
      email: userData.email,
      createdAt: userData.createdAt
    });
  } catch (error: any) {
    console.error('Check account status error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}