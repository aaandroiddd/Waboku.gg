import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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

    const { db } = getFirebaseAdmin();
    const listingsRef = db.collection('listings');
    
    // Query for mock listings using Admin SDK
    const mockListingsQuery = listingsRef.where('isMockListing', '==', true);
    
    const querySnapshot = await mockListingsQuery.get();
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