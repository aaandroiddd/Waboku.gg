import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listingId, userId } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: 'Missing listingId parameter' });
    }

    // Initialize Firebase Admin services
    const { db, admin } = getFirebaseAdmin();
    if (!db) {
      console.error('Firebase services not initialized');
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Get the listing document
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Don't count views from the listing owner
    const listingData = listingDoc.data();
    if (userId && userId === listingData?.userId) {
      return res.status(200).json({ 
        success: true, 
        message: 'View not counted - owner view',
        viewCount: listingData.viewCount || 0
      });
    }

    // Increment the view count
    await listingRef.update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });

    // Get the updated view count
    const updatedListingDoc = await listingRef.get();
    const updatedListingData = updatedListingDoc.data();

    return res.status(200).json({ 
      success: true, 
      viewCount: updatedListingData?.viewCount || 0 
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    return res.status(500).json({ error: 'Failed to track view' });
  }
}