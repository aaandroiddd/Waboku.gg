import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    let totalArchived = 0;
    
    // Get all active listings
    const activeListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    // Process each active listing
    const processPromises = activeListingsSnapshot.docs.map(async (doc) => {
      try {
        const data = doc.data();
        if (!data) return;

        const createdAt = data.createdAt?.toDate() || new Date();
        const userRef = db.collection('users').doc(data.userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        // Get user's account tier
        const accountTier = userData?.accountTier || 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier].listingDuration;
        
        // Calculate expiration time in milliseconds
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        if (new Date() > expirationTime) {
          // Instead of deleting, update the status to 'archived'
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt
          });
          totalArchived++;
        }
      } catch (error) {
        console.error(`Error processing listing ${doc.id}:`, error);
      }
    });

    // Wait for all listing processing to complete
    await Promise.all(processPromises);

    // Get inactive listings older than 7 days
    const inactiveSnapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .get();

    // Move inactive listings to archived as well
    inactiveSnapshot.docs.forEach((doc) => {
      try {
        const data = doc.data();
        if (!data) return;

        batch.update(doc.ref, {
          status: 'archived',
          archivedAt: Timestamp.now(),
          originalCreatedAt: data.createdAt
        });
        totalArchived++;
      } catch (error) {
        console.error(`Error processing inactive listing ${doc.id}:`, error);
      }
    });
    
    // Only commit if there are changes to make
    if (totalArchived > 0) {
      await batch.commit();
    }

    return res.status(200).json({ 
      message: `Successfully archived ${totalArchived} expired listings` 
    });
  } catch (error: any) {
    console.error('Error archiving expired listings:', error);
    return res.status(500).json({ 
      error: 'Failed to archive listings',
      details: error.message 
    });
  }
}