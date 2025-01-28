import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase-admin';
import { ref, query, orderByChild, equalTo, get, remove } from 'firebase/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get reference to listings
    const listingsRef = ref(db, 'listings');
    
    // Get all archived listings
    const archivedListingsQuery = query(
      listingsRef,
      orderByChild('status'),
      equalTo('archived')
    );

    const snapshot = await get(archivedListingsQuery);
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    if (snapshot.exists()) {
      const listings = snapshot.val();
      const deletionPromises: Promise<void>[] = [];

      // Check each archived listing
      Object.entries(listings).forEach(([id, listing]: [string, any]) => {
        const archivedAt = new Date(listing.archivedAt).getTime();
        
        // If listing has been archived for more than 7 days
        if (now - archivedAt >= SEVEN_DAYS_MS) {
          // Add to deletion queue
          deletionPromises.push(
            remove(ref(db, `listings/${id}`))
              .then(() => { deletedCount++; })
              .catch((error) => {
                console.error(`Failed to delete listing ${id}:`, error);
              })
          );
        }
      });

      // Wait for all deletions to complete
      await Promise.all(deletionPromises);
    }

    return res.status(200).json({
      message: `Successfully cleaned up ${deletedCount} expired archived listings`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up archived listings:', error);
    return res.status(500).json({
      error: 'Failed to clean up archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}