import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Helper function to log errors with context
const logError = (context: string, error: any, additionalInfo?: any) => {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify admin access
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`) {
    console.warn('[Test Cleanup] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Test Cleanup] Starting cleanup process', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    let totalDeleted = 0;

    // Get all archived listings older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .where('archivedAt', '<', Timestamp.fromDate(sevenDaysAgo))
      .get();

    console.log(`[Test Cleanup] Found ${archivedSnapshot.size} archived listings to clean up`);

    // First, log all listings that will be deleted
    const listingsToDelete = archivedSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    console.log('[Test Cleanup] Listings to be deleted:', JSON.stringify(listingsToDelete, null, 2));

    archivedSnapshot.docs.forEach((doc) => {
      try {
        batch.delete(doc.ref);
        totalDeleted++;
        console.log(`[Test Cleanup] Marked listing ${doc.id} for deletion`);
      } catch (error) {
        logError('Processing archived listing for deletion', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });

    // Commit all deletions
    if (totalDeleted > 0) {
      await batch.commit();
      console.log(`[Test Cleanup] Successfully deleted ${totalDeleted} archived listings`);
    } else {
      console.log('[Test Cleanup] No listings to delete');
    }

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} expired archived listings`,
      deletedCount: totalDeleted,
      deletedListings: listingsToDelete
    });
  } catch (error) {
    logError('Test cleanup archived listings', error);
    return res.status(500).json({
      error: 'Failed to clean up archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}