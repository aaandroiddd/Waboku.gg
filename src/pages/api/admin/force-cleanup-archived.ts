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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify admin access
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - missing authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_SECRET && token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }

  console.log('[Force Cleanup Archived] Starting manual cleanup process', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    
    let batch = db.batch();
    let batchOperations = 0;
    let totalDeleted = 0;
    let totalFavoritesRemoved = 0;
    let completedBatches = 0;

    // Get all archived listings (regardless of expiration time for debugging)
    const now = new Date();
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Force Cleanup Archived] Found ${archivedSnapshot.size} total archived listings`);

    // Separate expired and non-expired for analysis
    const expiredListings = [];
    const nonExpiredListings = [];

    for (const doc of archivedSnapshot.docs) {
      const data = doc.data();
      if (!data) continue;

      let expiresAt: Date;
      try {
        if (data.expiresAt) {
          expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        } else {
          // If no expiresAt, assume it should have been deleted (legacy data)
          expiresAt = new Date(0); // Very old date
        }

        if (now > expiresAt) {
          expiredListings.push({ doc, data, expiresAt });
        } else {
          nonExpiredListings.push({ doc, data, expiresAt });
        }
      } catch (error) {
        console.error(`[Force Cleanup Archived] Error parsing expiresAt for listing ${doc.id}:`, error);
        // If we can't parse the date, assume it's expired
        expiredListings.push({ doc, data, expiresAt: new Date(0) });
      }
    }

    console.log(`[Force Cleanup Archived] Analysis:`, {
      totalArchived: archivedSnapshot.size,
      expired: expiredListings.length,
      nonExpired: nonExpiredListings.length,
      currentTime: now.toISOString()
    });

    // Log some examples of non-expired listings for debugging
    if (nonExpiredListings.length > 0) {
      console.log('[Force Cleanup Archived] Sample non-expired listings:');
      nonExpiredListings.slice(0, 3).forEach(({ doc, expiresAt }) => {
        console.log(`  - ${doc.id}: expires at ${expiresAt.toISOString()}`);
      });
    }

    // Process expired listings
    const processPromises = expiredListings.map(async ({ doc, data }) => {
      try {
        const listingId = doc.id;
        
        // Find all users who have this listing in their favorites
        const favoritesQuery = await db.collectionGroup('favorites')
          .where('listingId', '==', listingId)
          .get();
        
        return {
          listingRef: doc.ref,
          listingId,
          userId: data.userId,
          favoriteRefs: favoritesQuery.docs.map(favoriteDoc => favoriteDoc.ref),
          archivedAt: data.archivedAt?.toDate?.()?.toISOString() || 'unknown',
          expiresAt: data.expiresAt?.toDate?.()?.toISOString() || 'unknown'
        };
      } catch (error) {
        logError('Processing expired archived listing for deletion', error, {
          listingId: doc.id,
          data: doc.data()
        });
        return null;
      }
    });

    // Wait for all processing to complete
    const processedListings = (await Promise.all(processPromises)).filter(Boolean);
    
    console.log(`[Force Cleanup Archived] Processed ${processedListings.length} expired listings with their favorites`);
    
    // Apply deletions in batches
    for (const listing of processedListings) {
      if (!listing) continue;
      
      // Delete the listing
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        completedBatches++;
        console.log(`[Force Cleanup Archived] Committed batch ${completedBatches} with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
      
      batch.delete(listing.listingRef);
      batchOperations++;
      totalDeleted++;
      
      // Delete all favorites referencing this listing
      for (const favoriteRef of listing.favoriteRefs) {
        if (batchOperations >= BATCH_SIZE) {
          await batch.commit();
          completedBatches++;
          console.log(`[Force Cleanup Archived] Committed batch ${completedBatches} with ${batchOperations} operations`);
          batch = db.batch();
          batchOperations = 0;
        }
        
        batch.delete(favoriteRef);
        batchOperations++;
        totalFavoritesRemoved++;
      }
      
      console.log(`[Force Cleanup Archived] Processed listing ${listing.listingId}`, {
        userId: listing.userId,
        archivedAt: listing.archivedAt,
        expiresAt: listing.expiresAt,
        favoritesCount: listing.favoriteRefs.length
      });
    }

    // Commit any remaining changes
    if (batchOperations > 0) {
      await batch.commit();
      completedBatches++;
      console.log(`[Force Cleanup Archived] Committed final batch ${completedBatches} with ${batchOperations} operations`);
    }

    const summary = {
      totalArchived: archivedSnapshot.size,
      expiredFound: expiredListings.length,
      nonExpiredFound: nonExpiredListings.length,
      totalDeleted,
      totalFavoritesRemoved,
      completedBatches,
      timestamp: new Date().toISOString()
    };

    console.log('[Force Cleanup Archived] Process completed successfully', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} expired archived listings and removed ${totalFavoritesRemoved} favorite references`,
      summary
    });
  } catch (error: any) {
    console.error('[Force Cleanup Archived] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    logError('Force cleanup archived listings', error);
    return res.status(500).json({
      error: 'Failed to clean up archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}