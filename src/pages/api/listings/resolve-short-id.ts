import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shortId } = req.query;

  if (!shortId || typeof shortId !== 'string') {
    return res.status(400).json({ error: 'Short ID is required' });
  }

  try {
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Query listings where the ID starts with the short ID
    const listingsRef = collection(db, 'listings');
    const q = query(
      listingsRef,
      where('__name__', '>=', shortId),
      where('__name__', '<', shortId + '\uf8ff'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const doc = querySnapshot.docs[0];
    const fullId = doc.id;

    // Verify that the full ID actually starts with the short ID
    if (!fullId.startsWith(shortId)) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    return res.status(200).json({ 
      success: true, 
      fullId,
      shortId 
    });

  } catch (error) {
    console.error('Error resolving short ID:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}