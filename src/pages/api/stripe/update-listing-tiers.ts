import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (!authResult.success) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { uid } = authResult;
    const { accountTier } = req.body;

    if (!accountTier || (accountTier !== 'free' && accountTier !== 'premium')) {
      return res.status(400).json({ error: 'Invalid account tier' });
    }

    // Get Firestore instance
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Find all active listings for this user
    const listingsSnapshot = await db.collection('listings')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .get();

    if (listingsSnapshot.empty) {
      return res.status(200).json({ 
        message: 'No active listings found to update',
        updated: 0
      });
    }

    // Update each listing with the new account tier
    const batch = db.batch();
    let updateCount = 0;

    listingsSnapshot.forEach(doc => {
      const listingData = doc.data();
      if (listingData.accountTier !== accountTier) {
        batch.update(doc.ref, { 
          accountTier,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      }
    });

    // Commit the batch if there are updates
    if (updateCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      message: `Successfully updated ${updateCount} listings to ${accountTier} tier`,
      updated: updateCount
    });
  } catch (error) {
    console.error('Error updating listing tiers:', error);
    return res.status(500).json({ error: 'Failed to update listing tiers' });
  }
}