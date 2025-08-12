import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Backup TTL cleanup mechanism
 * This can be triggered manually or by monitoring systems when the main cron job fails
 */

const BATCH_SIZE = 100; // Smaller batches for manual execution
const EMERGENCY_THRESHOLD_MINUTES = 180; // 3 hours

interface BackupCleanupResult {
  timestamp: string;
  triggerReason: string;
  emergencyMode: boolean;
  metrics: {
    totalFound: number;
    emergencyCount: number;
    deletedCount: number;
    skippedCount: number;
    executionTimeMs: number;
  };
  deletedListings: Array<{
    id: string;
    minutesOverdue: number;
    ttlReason: string;
  }>;
  errors: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = new Date();
  
  // Admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    emergencyOnly = false, 
    reason = 'manual_trigger',
    maxDeletions = 50 
  } = req.body;

  console.log('[Backup TTL Cleanup] Starting backup cleanup', {
    timestamp: startTime.toISOString(),
    emergencyOnly,
    reason,
    maxDeletions
  });

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const now = new Date();
    
    // Find expired listings
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(BATCH_SIZE * 2) // Get more to analyze
      .get();

    const result: BackupCleanupResult = {
      timestamp: now.toISOString(),
      triggerReason: reason,
      emergencyMode: emergencyOnly,
      metrics: {
        totalFound: expiredQuery.size,
        emergencyCount: 0,
        deletedCount: 0,
        skippedCount: 0,
        executionTimeMs: 0
      },
      deletedListings: [],
      errors: []
    };

    if (expiredQuery.empty) {
      result.metrics.executionTimeMs = Date.now() - startTime.getTime();
      return res.status(200).json({
        ...result,
        message: 'No expired listings found'
      });
    }

    // Analyze and categorize expired listings
    const listingsToDelete: Array<{
      doc: any;
      data: any;
      minutesOverdue: number;
      isEmergency: boolean;
    }> = [];

    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      const deleteAtDate = deleteAt?.toDate?.() || new Date(deleteAt);
      const minutesOverdue = Math.floor((now.getTime() - deleteAtDate.getTime()) / (1000 * 60));
      const isEmergency = minutesOverdue > EMERGENCY_THRESHOLD_MINUTES;
      
      if (isEmergency) {
        result.metrics.emergencyCount++;
      }

      // If emergency mode, only process emergency listings
      if (emergencyOnly && !isEmergency) {
        result.metrics.skippedCount++;
        continue;
      }

      listingsToDelete.push({
        doc,
        data,
        minutesOverdue,
        isEmergency
      });
    }

    // Limit deletions for safety
    const limitedListings = listingsToDelete.slice(0, maxDeletions);
    result.metrics.skippedCount += listingsToDelete.length - limitedListings.length;

    console.log('[Backup TTL Cleanup] Analysis complete', {
      totalFound: result.metrics.totalFound,
      emergencyCount: result.metrics.emergencyCount,
      toDelete: limitedListings.length,
      skipped: result.metrics.skippedCount
    });

    // Process deletions in batches
    let batch = db.batch();
    let batchOperations = 0;

    for (const { doc, data, minutesOverdue, isEmergency } of limitedListings) {
      console.log(`[Backup TTL Cleanup] Deleting listing ${doc.id}`, {
        minutesOverdue,
        isEmergency,
        ttlReason: data.ttlReason
      });

      // Delete the main listing document
      batch.delete(doc.ref);
      batchOperations++;
      result.metrics.deletedCount++;

      result.deletedListings.push({
        id: doc.id,
        minutesOverdue,
        ttlReason: data.ttlReason || 'unknown'
      });

      // Clean up related data
      try {
        if (data.shortId) {
          const shortIdRef = db.collection('shortIdMappings').doc(data.shortId);
          batch.delete(shortIdRef);
          batchOperations++;
        }

        if (data.userId) {
          const userListingRef = db.collection('users').doc(data.userId)
            .collection('listings').doc(doc.id);
          batch.delete(userListingRef);
          batchOperations++;
        }
      } catch (error) {
        const errorMsg = `Error cleaning related data for ${doc.id}: ${error}`;
        result.errors.push(errorMsg);
        console.warn(`[Backup TTL Cleanup] ${errorMsg}`);
      }

      // Commit batch if it's getting large
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        console.log(`[Backup TTL Cleanup] Committed batch with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
    }

    // Commit any remaining operations
    if (batchOperations > 0) {
      await batch.commit();
      console.log(`[Backup TTL Cleanup] Committed final batch with ${batchOperations} operations`);
    }

    result.metrics.executionTimeMs = Date.now() - startTime.getTime();

    const response = {
      ...result,
      message: `Backup cleanup completed: deleted ${result.metrics.deletedCount} listings`,
      recommendations: generateRecommendations(result)
    };

    console.log('[Backup TTL Cleanup] Completed successfully', {
      deletedCount: result.metrics.deletedCount,
      emergencyCount: result.metrics.emergencyCount,
      executionTimeMs: result.metrics.executionTimeMs,
      errors: result.errors.length
    });

    return res.status(200).json(response);

  } catch (error) {
    const executionTimeMs = Date.now() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Backup TTL Cleanup] Error during cleanup:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      error: 'Backup TTL cleanup failed',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      executionTimeMs
    });
  }
}

function generateRecommendations(result: BackupCleanupResult): string[] {
  const recommendations: string[] = [];
  
  if (result.metrics.emergencyCount > 0) {
    recommendations.push('Emergency listings found - investigate main cron job failure');
    recommendations.push('Check Vercel cron job logs and configuration');
  }
  
  if (result.metrics.skippedCount > 0) {
    recommendations.push(`${result.metrics.skippedCount} listings were skipped - consider running full cleanup`);
  }
  
  if (result.errors.length > 0) {
    recommendations.push('Some cleanup operations failed - check error logs');
  }
  
  if (result.metrics.deletedCount > 10) {
    recommendations.push('Large number of deletions suggests cron job issues - implement monitoring');
  }
  
  return recommendations;
}