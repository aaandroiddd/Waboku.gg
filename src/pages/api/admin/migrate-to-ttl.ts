import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { addTTLToListing, shouldImmediatelyDelete, LISTING_TTL_CONFIG, calculateImmediateTTL } from '@/lib/listing-ttl';

/**
 * Admin endpoint to migrate existing archived listings to use TTL
 * This is a one-time migration to add TTL fields to existing archived listings
 */

// Maximum number of operations in a single batch
const BATCH_SIZE = 500;

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
  console.log('[Migrate to TTL] Request received', {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: {
      authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'missing',
      'user-agent': req.headers['user-agent'],
      'x-vercel-cron': req.headers['x-vercel-cron']
    },
    environment: process.env.NODE_ENV
  });

  // Verify that this is an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    // This is a Vercel cron job - these are automatically authorized
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Migrate to TTL] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // This is a manual admin request - check the token
    const token = authHeader.split(' ')[1];
    if (token === process.env.ADMIN_SECRET) {
      isAuthorized = true;
      requestType = 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Migrate to TTL] Unauthorized access attempt', {
      hasAuth: !!authHeader,
      isVercelCron,
      userAgent: req.headers['user-agent']
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Migrate to TTL] Starting TTL migration process', {
    timestamp: new Date().toISOString(),
    requestType,
    isVercelCron
  });

  try {
    // Get Firebase admin instance
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      console.error('[Migrate to TTL] Firestore not available on admin instance');
      return res.status(500).json({ 
        error: 'Failed to initialize Firestore',
        details: 'Firestore not available on admin instance'
      });
    }
    
    const db = admin.firestore();
    console.log('[Migrate to TTL] Firestore initialized successfully');
    
    let batch = db.batch();
    let batchOperations = 0;
    let totalMigrated = 0;
    let totalImmediatelyExpired = 0;
    let completedBatches = 0;

    // Get all archived listings that don't have TTL field yet
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Migrate to TTL] Found ${archivedSnapshot.size} archived listings to check for migration`);

    const now = new Date();
    
    for (const doc of archivedSnapshot.docs) {
      try {
        const data = doc.data();
        if (!data) continue;

        // Skip if already has TTL field
        if (data[LISTING_TTL_CONFIG.ttlField]) {
          console.log(`[Migrate to TTL] Listing ${doc.id} already has TTL field, skipping`);
          continue;
        }

        let updateData;
        
        // Check if this listing should be immediately deleted
        if (shouldImmediatelyDelete(data)) {
          // Set TTL for immediate deletion (24 hour grace period)
          updateData = {
            [LISTING_TTL_CONFIG.ttlField]: calculateImmediateTTL(now),
            ttlSetAt: admin.firestore.Timestamp.now(),
            ttlReason: 'migration_immediate_expiry',
            migrationNote: 'Listing was already expired, set for immediate TTL deletion'
          };
          totalImmediatelyExpired++;
          console.log(`[Migrate to TTL] Listing ${doc.id} set for immediate TTL deletion (was already expired)`);
        } else {
          // Use existing archivedAt date to calculate proper TTL
          const archivedAt = data.archivedAt?.toDate() || now;
          updateData = {
            [LISTING_TTL_CONFIG.ttlField]: addTTLToListing(data, archivedAt)[LISTING_TTL_CONFIG.ttlField],
            ttlSetAt: admin.firestore.Timestamp.now(),
            ttlReason: 'migration_normal',
            migrationNote: 'TTL added during migration based on existing archivedAt date'
          };
          console.log(`[Migrate to TTL] Listing ${doc.id} migrated with TTL based on archivedAt: ${archivedAt.toISOString()}`);
        }

        batch.update(doc.ref, updateData);
        batchOperations++;
        totalMigrated++;

        if (batchOperations >= BATCH_SIZE) {
          await batch.commit();
          completedBatches++;
          console.log(`[Migrate to TTL] Committed batch ${completedBatches} with ${batchOperations} operations`);
          batch = db.batch();
          batchOperations = 0;
        }
      } catch (error) {
        logError('Migrating listing to TTL', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    }

    // Commit any remaining changes
    if (batchOperations > 0) {
      await batch.commit();
      completedBatches++;
      console.log(`[Migrate to TTL] Committed final batch ${completedBatches} with ${batchOperations} operations`);
    }

    const summary = {
      totalMigrated,
      totalImmediatelyExpired,
      completedBatches,
      timestamp: new Date().toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField,
      archiveDurationDays: LISTING_TTL_CONFIG.archiveDuration / (24 * 60 * 60 * 1000),
      gracePeriodHours: LISTING_TTL_CONFIG.gracePeriod / (60 * 60 * 1000)
    };

    console.log('[Migrate to TTL] Migration completed successfully', summary);

    return res.status(200).json({
      message: `Successfully migrated ${totalMigrated} archived listings to use TTL (${totalImmediatelyExpired} set for immediate deletion)`,
      summary
    });
  } catch (error: any) {
    console.error('[Migrate to TTL] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    logError('TTL migration', error);
    return res.status(500).json({
      error: 'Failed to migrate listings to TTL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}