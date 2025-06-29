import { NextApiRequest, NextApiResponse } from 'next';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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
    const count = querySnapshot.size;

    res.status(200).json({
      success: true,
      count
    });

  } catch (error: any) {
    console.error('Error fetching mock listings count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch mock listings count',
      details: error.message 
    });
  }
}