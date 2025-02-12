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

  // Verify admin authorization
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];  // Get the token part from "Bearer TOKEN"
  
  if (!token || token !== process.env.ADMIN_SECRET) {
    console.error('Unauthorized attempt to access admin endpoint');
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
      // Update all users to free tier unless they are already premium
      if (userData.accountTier !== 'premium') {
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