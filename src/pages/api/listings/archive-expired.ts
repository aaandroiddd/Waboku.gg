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
    const { rtdb } = getFirebaseAdmin();
    
    // Get all listings
    const listingsRef = rtdb.ref('listings');
    const listingsSnapshot = await listingsRef.get();
    
    if (!listingsSnapshot.exists()) {
      return res.status(200).json({ message: 'No listings to process' });
    }

    const updates: { [key: string]: any } = {};
    const now = Date.now();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    listingsSnapshot.forEach((listing) => {
      const listingData = listing.val();
      
      // Check if listing is from a free user and is expired
      if (!listingData.isPremium && 
          listingData.createdAt && 
          (now - listingData.createdAt) > FORTY_EIGHT_HOURS && 
          listingData.status === 'active') {
        
        // Update the listing status to archived
        updates[`listings/${listing.key}/status`] = 'archived';
        updates[`listings/${listing.key}/archivedAt`] = now;
      }
    });

    if (Object.keys(updates).length > 0) {
      // Perform all updates in a single operation
      await rtdb.ref().update(updates);
      console.log(`Successfully archived ${Object.keys(updates).length} expired listings`);
      return res.status(200).json({ 
        message: `Successfully archived ${Object.keys(updates).length} expired listings`,
        archivedCount: Object.keys(updates).length
      });
    }

    return res.status(200).json({ 
      message: 'No expired listings to archive',
      archivedCount: 0
    });

  } catch (error) {
    console.error('Error archiving expired listings:', error);
    return res.status(500).json({ 
      error: 'Failed to archive expired listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}