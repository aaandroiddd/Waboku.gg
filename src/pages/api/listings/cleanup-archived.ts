import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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

// Helper function to create a new batch when the current one is full
const createNewBatchIfNeeded = (db: FirebaseFirestore.Firestore, currentBatch: FirebaseFirestore.WriteBatch, operationCount: number) => {
  if (operationCount >= BATCH_SIZE) {
    return db.batch();
  }
  return currentBatch;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enhanced logging for debugging
  console.log('[Cleanup Archived] Request received', {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: {
      authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'missing',
      'user-agent': req.headers['user-agent'],
      'x-vercel-cron': req.headers['x-vercel-cron']
    },
    environment: process.env.NODE_ENV
  });

  // Verify that this is a cron job request from Vercel or an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    // This is a Vercel cron job - these are automatically authorized
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Cleanup Archived] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // This is a manual admin request - check the token
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Cleanup Archived] Unauthorized access attempt', {
      hasAuth: !!authHeader,
      isVercelCron,
      userAgent: req.headers['user-agent']
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cleanup Archived] Starting cleanup process', {
    timestamp: new Date().toISOString(),
    requestType,
    isVercelCron
  });

  try {
    // Get Firebase admin instance
    const admin = getFirebaseAdmin();
    
    // Explicitly initialize Firestore
    if (!admin.firestore) {
      console.error('[Cleanup Archived] Firestore not available on admin instance');
      return res.status(500).json({ 
        error: 'Failed to initialize Firestore',
        details: 'Firestore not available on admin instance'
      });
    }
    
    const db = admin.firestore();
    console.log('[Cleanup Archived] Firestore initialized successfully');
    
    let batch = db.batch();
    let batchOperations = 0;
    let totalDeleted = 0;
    let totalFavoritesRemoved = 0;
    let completedBatches = 0;

    // Get all archived listings and check their archive expiration individually
    const now = new Date();
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Cleanup Archived] Found ${archivedSnapshot.size} total archived listings to analyze`);

    // Filter for actually expired listings
    const expiredListings = [];
    
    for (const doc of archivedSnapshot.docs) {
      const data = doc.data();
      if (!data) continue;

      try {
        let isExpired = false;
        
        // For archived listings, check if 7 days have passed since archivedAt
        if (data.archivedAt) {
          const archivedDate = data.archivedAt.toDate ? data.archivedAt.toDate() : new Date(data.archivedAt);
          const archiveExpiresAt = new Date(archivedDate.getTime() + (7 * 24 * 60 * 60 * 1000));
          isExpired = now > archiveExpiresAt;
          
          console.log(`[Cleanup Archived] Listing ${doc.id}: archived ${archivedDate.toISOString()}, expires ${archiveExpiresAt.toISOString()}, expired: ${isExpired}`);
        } else if (data.expiresAt) {
          // Fallback to expiresAt field if archivedAt is not available
          const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          isExpired = now > expiresAt;
          
          console.log(`[Cleanup Archived] Listing ${doc.id} (using expiresAt): expires ${expiresAt.toISOString()}, expired: ${isExpired}`);
        } else {
          // If no timestamps, assume it should have been deleted (legacy data)
          isExpired = true;
          console.log(`[Cleanup Archived] Listing ${doc.id} has no timestamps - marking as expired`);
        }
        
        if (isExpired) {
          expiredListings.push(doc);
        }
      } catch (error) {
        console.error(`[Cleanup Archived] Error checking expiration for listing ${doc.id}:`, error);
        // If we can't parse the date, assume it's expired
        expiredListings.push(doc);
      }
    }

    console.log(`[Cleanup Archived] Found ${expiredListings.length} actually expired archived listings to clean up`);

    // Process each expired listing in parallel for better performance
    const processPromises = expiredListings.map(async (doc) => {
      try {
        const listingId = doc.id;
        const listingData = doc.data();
        
        // Find all users who have this listing in their favorites
        const favoritesQuery = await db.collectionGroup('favorites')
          .where('listingId', '==', listingId)
          .get();
        
        return {
          listingRef: doc.ref,
          listingId,
          userId: listingData.userId,
          favoriteRefs: favoritesQuery.docs.map(favoriteDoc => favoriteDoc.ref)
        };
      } catch (error) {
        logError('Processing archived listing for deletion', error, {
          listingId: doc.id,
          data: doc.data()
        });
        return null;
      }
    });

    // Wait for all processing to complete
    const processedListings = (await Promise.all(processPromises)).filter(Boolean);
    
    console.log(`[Cleanup Archived] Processed ${processedListings.length} expired listings with their favorites`);
    
    // Apply deletions in batches
    for (const listing of processedListings) {
      if (!listing) continue;
      
      // Delete the listing
      batch = createNewBatchIfNeeded(db, batch, batchOperations);
      batch.delete(listing.listingRef);
      batchOperations++;
      totalDeleted++;
      
      // Delete all favorites referencing this listing
      for (const favoriteRef of listing.favoriteRefs) {
        batch = createNewBatchIfNeeded(db, batch, batchOperations);
        batch.delete(favoriteRef);
        batchOperations++;
        totalFavoritesRemoved++;
      }
      
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        completedBatches++;
        console.log(`[Cleanup Archived] Committed batch ${completedBatches} with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
      
      console.log(`[Cleanup Archived] Processed listing ${listing.listingId} with ${listing.favoriteRefs.length} favorites`);
    }

    // Commit any remaining changes
    if (batchOperations > 0) {
      await batch.commit();
      completedBatches++;
      console.log(`[Cleanup Archived] Committed final batch ${completedBatches} with ${batchOperations} operations`);
    }

    const summary = {
      totalDeleted,
      totalFavoritesRemoved,
      completedBatches,
      timestamp: new Date().toISOString()
    };

    console.log('[Cleanup Archived] Process completed successfully', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} expired archived listings and removed ${totalFavoritesRemoved} favorite references`,
      summary
    });
  } catch (error: any) {
    console.error('[Cleanup Archived] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    logError('Cleanup archived listings', error);
    return res.status(500).json({
      error: 'Failed to clean up archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}