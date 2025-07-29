import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Cron job to cleanup expired TTL listings
 * This serves as a backup to Firestore's native TTL functionality
 */

const BATCH_SIZE = 500;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify this is a cron job or admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = req.headers['x-cron-secret'];
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  
  if (isVercelCron || cronSecret === process.env.CRON_SECRET) {
    isAuthorized = true;
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    if (token === process.env.ADMIN_SECRET) {
      isAuthorized = true;
    }
  }
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[TTL Cleanup] Starting TTL cleanup process', {
    timestamp: new Date().toISOString(),
    isVercelCron,
    hasCronSecret: !!cronSecret
  });

  try {
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      console.error('[TTL Cleanup] Firestore not available');
      return res.status(500).json({ error: 'Firestore not available' });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    // Find all listings with expired TTL
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(BATCH_SIZE)
      .get();

    console.log(`[TTL Cleanup] Found ${expiredQuery.size} expired listings to delete`);

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
    const deletedListings: string[] = [];

    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      
      console.log(`[TTL Cleanup] Deleting expired listing ${doc.id}`, {
        deleteAt: deleteAt?.toDate?.()?.toISOString() || deleteAt,
        currentTime: now.toISOString(),
        ttlReason: data.ttlReason
      });

      // Delete the main listing document
      batch.delete(doc.ref);
      batchOperations++;
      totalDeleted++;
      deletedListings.push(doc.id);

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
        console.warn(`[TTL Cleanup] Error cleaning related data for ${doc.id}:`, error);
      }

      // Commit batch if it's getting large
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`[TTL Cleanup] Committed batch with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
    }

    // Commit any remaining operations
    if (batchOperations > 0) {
      await batch.commit();
      console.log(`[TTL Cleanup] Committed final batch with ${batchOperations} operations`);
    }

    const result = {
      message: `Successfully deleted ${totalDeleted} expired listings`,
      deletedCount: totalDeleted,
      deletedListings: deletedListings.slice(0, 10), // Only show first 10 for brevity
      timestamp: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField
    };

    console.log('[TTL Cleanup] Cleanup completed successfully', result);

    return res.status(200).json(result);

  } catch (error) {
    console.error('[TTL Cleanup] Error during cleanup:', error);
    return res.status(500).json({
      error: 'Failed to cleanup expired listings',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}