import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    initAdmin();
    const db = getFirestore();

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    // Batch update for better performance
    const batch = db.batch();
    let updatedCount = 0;

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (!userData.accountTier) {
        batch.update(doc.ref, {
          accountTier: 'free'
        });
        updatedCount++;
      }
    });

    // Commit the batch
    await batch.commit();

    return res.status(200).json({ 
      message: `Successfully updated ${updatedCount} users to free tier`,
      updatedCount 
    });
  } catch (error) {
    console.error('Error updating user tiers:', error);
    return res.status(500).json({ error: 'Failed to update user tiers' });
  }
}