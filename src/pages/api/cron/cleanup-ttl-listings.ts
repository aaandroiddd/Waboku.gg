import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Enhanced cron job to cleanup expired TTL listings
 * This serves as a backup to Firestore's native TTL functionality
 * Now includes comprehensive logging, monitoring, and alerting
 */

const BATCH_SIZE = 500;
const MAX_EXECUTION_TIME = 50000; // 50 seconds (Vercel limit is 60s)

interface CleanupMetrics {
  startTime: Date;
  endTime?: Date;
  executionTimeMs?: number;
  foundExpired: number;
  deletedCount: number;
  errors: string[];
  batchesProcessed: number;
  oldestExpiredMinutes?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = new Date();
  const metrics: CleanupMetrics = {
    startTime,
    foundExpired: 0,
    deletedCount: 0,
    errors: [],
    batchesProcessed: 0
  };

  // Verify this is a cron job or admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = req.headers['x-cron-secret'];
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let authMethod = 'none';
  
  if (isVercelCron) {
    isAuthorized = true;
    authMethod = 'vercel-cron';
  } else if (cronSecret === process.env.CRON_SECRET) {
    isAuthorized = true;
    authMethod = 'cron-secret';
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    if (token === process.env.ADMIN_SECRET) {
      isAuthorized = true;
      authMethod = 'admin-token';
    }
  }
  
  if (!isAuthorized) {
    console.error('[TTL Cleanup] Unauthorized access attempt', {
      timestamp: startTime.toISOString(),
      headers: {
        'x-vercel-cron': req.headers['x-vercel-cron'],
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for']
      }
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[TTL Cleanup] Starting TTL cleanup process', {
    timestamp: startTime.toISOString(),
    authMethod,
    isVercelCron,
    hasCronSecret: !!cronSecret,
    userAgent: req.headers['user-agent'],
    environment: process.env.NODE_ENV
  });

  try {
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      const error = 'Firestore not available';
      console.error(`[TTL Cleanup] ${error}`);
      metrics.errors.push(error);
      return res.status(500).json({ error, metrics });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    // Log current system time and TTL configuration
    console.log('[TTL Cleanup] System configuration', {
      currentTime: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField,
      batchSize: BATCH_SIZE,
      maxExecutionTime: MAX_EXECUTION_TIME
    });
    
    // Find all listings with expired TTL
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(BATCH_SIZE)
      .get();

    metrics.foundExpired = expiredQuery.size;
    console.log(`[TTL Cleanup] Found ${expiredQuery.size} expired listings to delete`);

    if (expiredQuery.empty) {
      metrics.endTime = new Date();
      metrics.executionTimeMs = metrics.endTime.getTime() - startTime.getTime();
      
      const result = {
        message: 'No expired listings found',
        deletedCount: 0,
        timestamp: now.toISOString(),
        metrics,
        success: true
      };
      
      console.log('[TTL Cleanup] No work needed', result);
      return res.status(200).json(result);
    }

    // Calculate how overdue the oldest listing is
    let oldestExpiredTime: Date | null = null;
    const expiredListingsInfo: Array<{id: string, deleteAt: Date, minutesOverdue: number}> = [];
    
    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      const deleteAtDate = deleteAt?.toDate?.() || new Date(deleteAt);
      const minutesOverdue = Math.floor((now.getTime() - deleteAtDate.getTime()) / (1000 * 60));
      
      expiredListingsInfo.push({
        id: doc.id,
        deleteAt: deleteAtDate,
        minutesOverdue
      });
      
      if (!oldestExpiredTime || deleteAtDate < oldestExpiredTime) {
        oldestExpiredTime = deleteAtDate;
      }
    }
    
    if (oldestExpiredTime) {
      metrics.oldestExpiredMinutes = Math.floor((now.getTime() - oldestExpiredTime.getTime()) / (1000 * 60));
    }

    // Log details about expired listings
    console.log('[TTL Cleanup] Expired listings analysis', {
      totalExpired: expiredListingsInfo.length,
      oldestExpiredMinutes: metrics.oldestExpiredMinutes,
      expiredListings: expiredListingsInfo.slice(0, 5).map(item => ({
        id: item.id,
        deleteAt: item.deleteAt.toISOString(),
        minutesOverdue: item.minutesOverdue
      }))
    });

    let batch = db.batch();
    let batchOperations = 0;
    let totalDeleted = 0;
    const deletedListings: Array<{id: string, minutesOverdue: number}> = [];
    const executionStartTime = Date.now();

    for (const doc of expiredQuery.docs) {
      // Check execution time limit
      if (Date.now() - executionStartTime > MAX_EXECUTION_TIME) {
        console.warn('[TTL Cleanup] Approaching execution time limit, stopping early');
        metrics.errors.push('Execution time limit reached');
        break;
      }

      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      const deleteAtDate = deleteAt?.toDate?.() || new Date(deleteAt);
      const minutesOverdue = Math.floor((now.getTime() - deleteAtDate.getTime()) / (1000 * 60));
      
      console.log(`[TTL Cleanup] Deleting expired listing ${doc.id}`, {
        deleteAt: deleteAtDate.toISOString(),
        currentTime: now.toISOString(),
        minutesOverdue,
        ttlReason: data.ttlReason,
        archivedAt: data.archivedAt?.toDate?.()?.toISOString()
      });

      // Delete the main listing document
      batch.delete(doc.ref);
      batchOperations++;
      totalDeleted++;
      deletedListings.push({ id: doc.id, minutesOverdue });

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
        const errorMsg = `Error cleaning related data for ${doc.id}: ${error}`;
        console.warn(`[TTL Cleanup] ${errorMsg}`);
        metrics.errors.push(errorMsg);
      }

      // Commit batch if it's getting large
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        metrics.batchesProcessed++;
        console.log(`[TTL Cleanup] Committed batch ${metrics.batchesProcessed} with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
    }

    // Commit any remaining operations
    if (batchOperations > 0) {
      await batch.commit();
      metrics.batchesProcessed++;
      console.log(`[TTL Cleanup] Committed final batch ${metrics.batchesProcessed} with ${batchOperations} operations`);
    }

    metrics.endTime = new Date();
    metrics.executionTimeMs = metrics.endTime.getTime() - startTime.getTime();
    metrics.deletedCount = totalDeleted;

    const result = {
      message: `Successfully deleted ${totalDeleted} expired listings`,
      deletedCount: totalDeleted,
      deletedListings: deletedListings.slice(0, 10), // Only show first 10 for brevity
      timestamp: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField,
      metrics,
      success: true
    };

    // Log success with comprehensive metrics
    console.log('[TTL Cleanup] Cleanup completed successfully', {
      ...result,
      performance: {
        executionTimeMs: metrics.executionTimeMs,
        listingsPerSecond: metrics.executionTimeMs ? (totalDeleted / (metrics.executionTimeMs / 1000)).toFixed(2) : 0,
        batchesProcessed: metrics.batchesProcessed
      }
    });

    // Alert if listings were significantly overdue
    if (metrics.oldestExpiredMinutes && metrics.oldestExpiredMinutes > 150) { // More than 2.5 hours overdue
      console.warn('[TTL Cleanup] ALERT: Found significantly overdue listings', {
        oldestExpiredMinutes: metrics.oldestExpiredMinutes,
        totalOverdue: totalDeleted,
        cronSchedule: '15 */2 * * * (every 2 hours)',
        possibleIssue: 'Cron job may not be executing properly'
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    metrics.endTime = new Date();
    metrics.executionTimeMs = metrics.endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    metrics.errors.push(errorMessage);
    
    console.error('[TTL Cleanup] Error during cleanup:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      metrics,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      error: 'Failed to cleanup expired listings',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      metrics,
      success: false
    });
  }
}