import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    let totalDeleted = 0;
    
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Query for inactive listings older than 7 days
    const inactiveSnapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(sevenDaysAgo))
      .get();

    inactiveSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    totalDeleted += inactiveSnapshot.size;

    // Query for archived listings that have expired
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    // Check each archived listing if it has expired (7 days after being archived)
    archivedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const archivedAt = data.archivedAt?.toDate() || data.updatedAt?.toDate();
      
      if (archivedAt) {
        const expirationDate = new Date(archivedAt);
        expirationDate.setDate(expirationDate.getDate() + 7);
        
        if (new Date() > expirationDate) {
          batch.delete(doc.ref);
          totalDeleted++;
        }
      }
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