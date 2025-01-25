import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ref, query, get, update } from 'firebase/database';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all listings
    const listingsRef = ref(db, 'listings');
    const listingsSnapshot = await get(query(listingsRef));
    
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
      await update(ref(db), updates);
      console.log(`Successfully archived ${Object.keys(updates).length} expired listings`);
      return res.status(200).json({ 
        message: `Successfully archived ${Object.keys(updates).length} expired listings`
      });
    }

    return res.status(200).json({ message: 'No expired listings to archive' });

  } catch (error) {
    console.error('Error archiving expired listings:', error);
    return res.status(500).json({ error: 'Failed to archive expired listings' });
  }
}