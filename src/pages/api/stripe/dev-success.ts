import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { initAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin
initAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow this endpoint in development/preview
  if (process.env.NEXT_PUBLIC_CO_DEV_ENV !== 'preview') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get database reference
    const db = getDatabase();
    
    // Update user's subscription status
    await db.ref(`users/${userId}/account`).update({
      tier: 'premium',
      stripeSubscriptionId: 'dev_test_subscription',
      subscriptionStatus: 'active',
      subscriptionPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in dev-success:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}