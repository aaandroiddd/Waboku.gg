import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Manual TTL cleanup tool for admin use
 * Immediately deletes all expired TTL listings
 */

const BATCH_SIZE = 500;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Admin authentication
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Manual TTL Cleanup] Starting manual TTL cleanup process', {
    timestamp: new Date().toISOString()
  });

  try {
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      console.error('[Manual TTL Cleanup] Firestore not available');
      return res.status(500).json({ error: 'Firestore not available' });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    // Find all listings with expired TTL
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(BATCH_SIZE)
      .get();

    console.log(`[Manual TTL Cleanup] Found ${expiredQuery.size} expired listings to delete`);

    if (expiredQuery.empty) {
      return res.status(200).json({
        message: 'No expired listings found',
        deletedCount: 0,
        timestamp: now.toISOString()
      });
    }

    let batch = db.batch();
    let batchOperations = 0;
    let totalDeleted = 0;
    const deletedListings: Array<{
      id: string;
      deleteAt: string;
      minutesPastDeletion: number;
      ttlReason?: string;
    }> = [];

    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      const deleteAtDate = deleteAt?.toDate?.() || new Date(deleteAt);
      const minutesPastDeletion = Math.floor((now.getTime() - deleteAtDate.getTime()) / (1000 * 60));
      
      console.log(`[Manual TTL Cleanup] Deleting expired listing ${doc.id}`, {
        deleteAt: deleteAtDate.toISOString(),
        currentTime: now.toISOString(),
        minutesPastDeletion,
        ttlReason: data.ttlReason
      });

      // Delete the main listing document
      batch.delete(doc.ref);
      batchOperations++;
      totalDeleted++;
      
      deletedListings.push({
        id: doc.id,
        deleteAt: deleteAtDate.toISOString(),
        minutesPastDeletion,
        ttlReason: data.ttlReason
      });

      // Also clean up related data
      try {
        // Delete from shortIdMappings if exists
        if (data.shortId) {
          const shortIdRef = db.collection('shortIdMappings').doc(data.shortId);
          batch.delete(shortIdRef);
          batchOperations++;
        }

        // Delete user's listing reference
        if (data.userId) {
          const userListingRef = db.collection('users').doc(data.userId)
            .collection('listings').doc(doc.id);
          batch.delete(userListingRef);
          batchOperations++;
        }
      } catch (error) {
        console.warn(`[Manual TTL Cleanup] Error cleaning related data for ${doc.id}:`, error);
      }

      // Commit batch if it's getting large
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`[Manual TTL Cleanup] Committed batch with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
    }

    // Commit any remaining operations
    if (batchOperations > 0) {
      await batch.commit();
      console.log(`[Manual TTL Cleanup] Committed final batch with ${batchOperations} operations`);
    }

    const result = {
      message: `Successfully deleted ${totalDeleted} expired listings`,
      deletedCount: totalDeleted,
      deletedListings,
      timestamp: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField,
      cronJobSchedule: "15 */2 * * * (every 2 hours at :15)",
      note: "These listings should have been deleted by the automated cron job"
    };

    console.log('[Manual TTL Cleanup] Cleanup completed successfully', result);

    return res.status(200).json(result);

  } catch (error) {
    console.error('[Manual TTL Cleanup] Error during cleanup:', error);
    return res.status(500).json({
      error: 'Failed to cleanup expired listings',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}