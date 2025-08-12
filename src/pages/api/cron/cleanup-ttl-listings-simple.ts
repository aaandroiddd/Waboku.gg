import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Simplified TTL cleanup cron job
 * Uses the exact same logic as the working manual cleanup tool
 */

const BATCH_SIZE = 500;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = new Date();
  
  // Simplified authentication - same as manual cleanup
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = req.headers['x-cron-secret'];
  
  // Allow Vercel cron, cron secret, or admin token
  const isAuthorized = isVercelCron || 
                      cronSecret === process.env.CRON_SECRET ||
                      (authHeader?.startsWith('Bearer ') && authHeader.replace('Bearer ', '') === process.env.ADMIN_SECRET);
  
  if (!isAuthorized) {
    console.error('[Simple TTL Cleanup] Unauthorized access attempt', {
      timestamp: startTime.toISOString(),
      hasVercelCron: isVercelCron,
      hasCronSecret: !!cronSecret,
      hasAuthHeader: !!authHeader
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Simple TTL Cleanup] Starting TTL cleanup process', {
    timestamp: startTime.toISOString(),
    authMethod: isVercelCron ? 'vercel-cron' : cronSecret ? 'cron-secret' : 'admin-token'
  });

  try {
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      console.error('[Simple TTL Cleanup] Firestore not available');
      return res.status(500).json({ error: 'Firestore not available' });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    console.log('[Simple TTL Cleanup] Querying for expired listings', {
      currentTime: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField
    });
    
    // Find all listings with expired TTL - EXACT same query as manual cleanup
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(BATCH_SIZE)
      .get();

    console.log(`[Simple TTL Cleanup] Found ${expiredQuery.size} expired listings to delete`);

    if (expiredQuery.empty) {
      const result = {
        message: 'No expired listings found',
        deletedCount: 0,
        timestamp: now.toISOString(),
        executionTimeMs: Date.now() - startTime.getTime()
      };
      console.log('[Simple TTL Cleanup] No work needed', result);
      return res.status(200).json(result);
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

    // EXACT same deletion logic as manual cleanup
    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      const deleteAtDate = deleteAt?.toDate?.() || new Date(deleteAt);
      const minutesPastDeletion = Math.floor((now.getTime() - deleteAtDate.getTime()) / (1000 * 60));
      
      console.log(`[Simple TTL Cleanup] Deleting expired listing ${doc.id}`, {
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
        console.warn(`[Simple TTL Cleanup] Error cleaning related data for ${doc.id}:`, error);
      }

      // Commit batch if it's getting large
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`[Simple TTL Cleanup] Committed batch with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
    }

    // Commit any remaining operations
    if (batchOperations > 0) {
      await batch.commit();
      console.log(`[Simple TTL Cleanup] Committed final batch with ${batchOperations} operations`);
    }

    const executionTimeMs = Date.now() - startTime.getTime();
    const result = {
      message: `Successfully deleted ${totalDeleted} expired listings`,
      deletedCount: totalDeleted,
      deletedListings,
      timestamp: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField,
      executionTimeMs,
      success: true
    };

    console.log('[Simple TTL Cleanup] Cleanup completed successfully', result);
    return res.status(200).json(result);

  } catch (error) {
    const executionTimeMs = Date.now() - startTime.getTime();
    console.error('[Simple TTL Cleanup] Error during cleanup:', error);
    return res.status(500).json({
      error: 'Failed to cleanup expired listings',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      executionTimeMs,
      success: false
    });
  }
}