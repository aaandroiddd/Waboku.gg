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
    let totalDeleted = 0;
    
    // Get all active listings
    const activeListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    // Process each active listing
    for (const doc of activeListingsSnapshot.docs) {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate() || new Date();
      const userRef = db.collection('users').doc(data.userId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      
      // Get user's account tier
      const accountTier = userData?.accountTier || 'free';
      const tierDuration = ACCOUNT_TIERS[accountTier].listingDuration;
      
      // Calculate expiration time in milliseconds
      const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
      
      if (new Date() > expirationTime) {
        batch.delete(doc.ref);
        totalDeleted++;
      }
    }

    // Get archived listings
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    // Process each archived listing
    archivedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const archivedAt = data.archivedAt?.toDate() || data.updatedAt?.toDate();
      
      if (archivedAt) {
        const expirationDate = new Date(archivedAt);
        expirationDate.setDate(expirationDate.getDate() + 7); // Archived listings are deleted after 7 days
        
        if (new Date() > expirationDate) {
          batch.delete(doc.ref);
          totalDeleted++;
        }
      }
    });

    // Get inactive listings
    const inactiveSnapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .get();

    // Process each inactive listing
    inactiveSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      totalDeleted++;
    });
    
    await batch.commit();

    return res.status(200).json({ 
      message: `Successfully deleted ${totalDeleted} expired listings` 
    });
  } catch (error: any) {
    console.error('Error cleaning up expired listings:', error);
    return res.status(500).json({ error: error.message });
  }
}