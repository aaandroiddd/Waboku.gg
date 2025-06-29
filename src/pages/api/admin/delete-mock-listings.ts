import { NextApiRequest, NextApiResponse } from 'next';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin access
    const adminSecret = req.headers['x-admin-secret'] as string;
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { db } = await getFirebaseServices();
    const listingsRef = collection(db, 'listings');
    
    // Query for mock listings
    const mockListingsQuery = query(
      listingsRef,
      where('isMockListing', '==', true)
    );
    
    const querySnapshot = await getDocs(mockListingsQuery);
    const deletedCount = querySnapshot.size;

    if (deletedCount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No mock listings found to delete',
        deletedCount: 0
      });
    }

    // Delete all mock listings
    const deletePromises = querySnapshot.docs.map(docSnapshot => {
      return deleteDoc(doc(db, 'listings', docSnapshot.id));
    });

    await Promise.all(deletePromises);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedCount} mock listings`,
      deletedCount
    });

  } catch (error: any) {
    console.error('Error deleting mock listings:', error);
    res.status(500).json({ 
      error: 'Failed to delete mock listings',
      details: error.message 
    });
  }
}