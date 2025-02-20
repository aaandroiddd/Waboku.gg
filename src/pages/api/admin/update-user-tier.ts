import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, tier } = req.body;

  // Validate input
  if (!userId || !tier) {
    return res.status(400).json({ error: 'Missing required fields: userId and tier' });
  }

  if (!['free', 'premium'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier. Must be either "free" or "premium"' });
  }

  try {
    // Initialize Firebase Admin
    const app = initAdmin();
    const db = getFirestore(app);

    // Get user document
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's tier
    await userRef.update({
      accountTier: tier,
      updatedAt: new Date(),
      'subscription.manuallyUpdated': true,
      'subscription.lastManualUpdate': new Date()
    });

    console.log(`Successfully updated user ${userId} to ${tier} tier`);

    return res.status(200).json({
      message: `Successfully updated user tier`,
      userId,
      newTier: tier
    });

  } catch (error) {
    console.error('Error updating user tier:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}