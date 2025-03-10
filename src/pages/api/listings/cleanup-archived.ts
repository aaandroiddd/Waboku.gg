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
  // Verify that this is a cron job request from Vercel or an admin request
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[Cleanup Archived] Unauthorized access attempt - missing or invalid authorization header');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  // Accept either CRON_SECRET (for automated jobs) or ADMIN_SECRET (for admin dashboard)
  if (token !== process.env.CRON_SECRET && token !== process.env.ADMIN_SECRET) {
    console.warn('[Cleanup Archived] Unauthorized access attempt - invalid token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cleanup Archived] Starting cleanup process', new Date().toISOString());

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

    // Get all archived listings that have expired
    const now = new Date();
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .where('expiresAt', '<', Timestamp.fromDate(now))
      .get();

    console.log(`[Cleanup Archived] Found ${archivedSnapshot.size} archived listings to clean up`);

    // Process each listing in parallel for better performance
    const processPromises = archivedSnapshot.docs.map(async (doc) => {
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