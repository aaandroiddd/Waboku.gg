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
  // Verify that this is a cron job request from Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[Cleanup Archived] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cleanup Archived] Starting cleanup process', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    let totalDeleted = 0;

    // Get all archived listings that have expired
    const now = new Date();
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .where('expiresAt', '<', Timestamp.fromDate(now))
      .get();

    console.log(`[Cleanup Archived] Found ${archivedSnapshot.size} archived listings to clean up`);

    archivedSnapshot.docs.forEach((doc) => {
      try {
        batch.delete(doc.ref);
        totalDeleted++;
        console.log(`[Cleanup Archived] Marked listing ${doc.id} for deletion`);
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
      console.log(`[Cleanup Archived] Successfully deleted ${totalDeleted} archived listings`);
    } else {
      console.log('[Cleanup Archived] No listings to delete');
    }

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} expired archived listings`,
      deletedCount: totalDeleted
    });
  } catch (error) {
    logError('Cleanup archived listings', error);
    return res.status(500).json({
      error: 'Failed to clean up archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}