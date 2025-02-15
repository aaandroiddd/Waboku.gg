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

  try {
    // Initialize Firebase Admin
    const app = initAdmin();
    const db = getFirestore(app);

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const updates: Promise<any>[] = [];
    let fixedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const subscription = userData.subscription || {};
      
      // Determine correct tier based on subscription status
      const isActivePremium = (
        subscription.status === 'active' ||
        (subscription.status === 'canceled' && 
         subscription.endDate && 
         new Date(subscription.endDate) > new Date())
      );

      const correctTier = isActivePremium ? 'premium' : 'free';

      // If there's a mismatch, queue an update
      if (userData.accountTier !== correctTier) {
        fixedCount++;
        updates.push(doc.ref.update({
          accountTier: correctTier,
          updatedAt: new Date()
        }));
      }
    }

    // Execute all updates
    await Promise.all(updates);

    return res.status(200).json({
      message: `Fixed ${fixedCount} accounts with mismatched tiers`,
      fixedCount
    });

  } catch (error) {
    console.error('Error fixing subscription tiers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}