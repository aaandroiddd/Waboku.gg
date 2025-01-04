import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = getFirebaseAdmin();
    
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Query for inactive listings older than 7 days
    const snapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(sevenDaysAgo))
      .get();

    // Delete the found listings
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    return res.status(200).json({ 
      message: `Successfully deleted ${snapshot.size} inactive listings` 
    });
  } catch (error: any) {
    console.error('Error cleaning up inactive listings:', error);
    return res.status(500).json({ error: error.message });
  }
}