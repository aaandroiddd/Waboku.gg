import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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

  console.log('[Force Cleanup Archived] Starting enhanced cleanup process with admin privileges', new Date().toISOString());

  try {
    const { admin, db } = getFirebaseAdmin();
    
    // Verify we have admin privileges
    console.log('[Force Cleanup Archived] Verifying Firebase Admin SDK privileges...');
    
    let totalDeleted = 0;
    let totalFavoritesRemoved = 0;
    let errors = [];

    // Get all archived listings using admin privileges
    const now = new Date();
    console.log('[Force Cleanup Archived] Querying archived listings with admin privileges...');
    
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Force Cleanup Archived] Found ${archivedSnapshot.size} total archived listings`);

    // Process each listing individually for better error handling
    const expiredListings = [];
    const nonExpiredListings = [];

    for (const doc of archivedSnapshot.docs) {
      const data = doc.data();
      if (!data) continue;

      let expiresAt: Date;
      let isExpired = false;

      try {
        // For archived listings, we need to check the archive expiration time
        // This should be 7 days after the archivedAt timestamp
        if (data.archivedAt) {
          const archivedDate = data.archivedAt.toDate ? data.archivedAt.toDate() : new Date(data.archivedAt);
          // Archived listings expire 7 days after being archived
          expiresAt = new Date(archivedDate.getTime() + (7 * 24 * 60 * 60 * 1000));
          isExpired = now > expiresAt;
          
          console.log(`[Force Cleanup Archived] Listing ${doc.id}:`, {
            archivedAt: archivedDate.toISOString(),
            calculatedExpiresAt: expiresAt.toISOString(),
            firestoreExpiresAt: data.expiresAt?.toDate?.()?.toISOString() || 'not set',
            currentTime: now.toISOString(),
            isExpired,
            timeUntilExpiry: Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours'
          });
        } else if (data.expiresAt) {
          // Fallback to expiresAt field if archivedAt is not available
          expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          isExpired = now > expiresAt;
          
          console.log(`[Force Cleanup Archived] Listing ${doc.id} (using expiresAt):`, {
            expiresAt: expiresAt.toISOString(),
            currentTime: now.toISOString(),
            isExpired,
            timeUntilExpiry: Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours'
          });
        } else {
          // If no timestamps, assume it should have been deleted (legacy data)
          expiresAt = new Date(0); // Very old date
          isExpired = true;
          
          console.log(`[Force Cleanup Archived] Listing ${doc.id} has no timestamps - marking as expired`);
        }

        if (isExpired) {
          expiredListings.push({ doc, data, expiresAt });
        } else {
          nonExpiredListings.push({ doc, data, expiresAt });
        }
      } catch (error) {
        console.error(`[Force Cleanup Archived] Error parsing timestamps for listing ${doc.id}:`, error);
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

    // Process expired listings using batch operations for better performance and admin privileges
    console.log('[Force Cleanup Archived] Processing expired listings with batch operations...');
    
    const batchSize = 500; // Firestore batch limit
    const batches = [];
    
    for (let i = 0; i < expiredListings.length; i += batchSize) {
      const batch = db.batch();
      const batchListings = expiredListings.slice(i, i + batchSize);
      
      console.log(`[Force Cleanup Archived] Creating batch ${Math.floor(i / batchSize) + 1} with ${batchListings.length} listings`);
      
      for (const { doc, data } of batchListings) {
        const listingId = doc.id;
        
        try {
          // Add listing deletion to batch
          batch.delete(doc.ref);
          
          console.log(`[Force Cleanup Archived] Added listing ${listingId} to batch for deletion`, {
            userId: data.userId,
            archivedAt: data.archivedAt?.toDate?.()?.toISOString() || 'unknown',
            expiresAt: data.expiresAt?.toDate?.()?.toISOString() || 'unknown'
          });
          
        } catch (error) {
          console.error(`[Force Cleanup Archived] Error preparing listing ${listingId} for batch:`, error);
          errors.push({
            type: 'batch_preparation',
            listingId,
            error: error.message || 'Unknown error'
          });
        }
      }
      
      batches.push({ batch, listings: batchListings });
    }
    
    // Execute all batches
    console.log(`[Force Cleanup Archived] Executing ${batches.length} batches...`);
    
    for (let i = 0; i < batches.length; i++) {
      const { batch, listings } = batches[i];
      
      try {
        console.log(`[Force Cleanup Archived] Executing batch ${i + 1}/${batches.length} with ${listings.length} operations...`);
        
        // Use admin privileges to commit the batch
        await batch.commit();
        
        totalDeleted += listings.length;
        console.log(`[Force Cleanup Archived] Successfully executed batch ${i + 1}, deleted ${listings.length} listings`);
        
      } catch (batchError: any) {
        console.error(`[Force Cleanup Archived] Batch ${i + 1} execution failed:`, {
          message: batchError.message,
          code: batchError.code,
          details: batchError.details
        });
        
        // Add individual errors for each listing in the failed batch
        for (const { doc } of listings) {
          errors.push({
            type: 'listing_deletion',
            listingId: doc.id,
            error: `Batch operation failed: ${batchError.code || batchError.message}`
          });
        }
      }
    }
    
    // Now handle favorites cleanup separately
    console.log('[Force Cleanup Archived] Cleaning up favorites for deleted listings...');
    
    for (const { doc } of expiredListings) {
      const listingId = doc.id;
      
      try {
        // Find all users who have this listing in their favorites
        const favoritesQuery = await db.collectionGroup('favorites')
          .where('listingId', '==', listingId)
          .get();

        console.log(`[Force Cleanup Archived] Found ${favoritesQuery.size} favorites for listing ${listingId}`);

        // Delete all favorites referencing this listing using batch operations
        if (favoritesQuery.size > 0) {
          const favoriteBatch = db.batch();
          
          for (const favoriteDoc of favoritesQuery.docs) {
            favoriteBatch.delete(favoriteDoc.ref);
          }
          
          await favoriteBatch.commit();
          totalFavoritesRemoved += favoritesQuery.size;
          console.log(`[Force Cleanup Archived] Deleted ${favoritesQuery.size} favorites for listing ${listingId}`);
        }

      } catch (favoriteError: any) {
        console.error(`[Force Cleanup Archived] Error cleaning up favorites for listing ${listingId}:`, favoriteError);
        errors.push({
          type: 'favorite_cleanup',
          listingId,
          error: favoriteError.message || 'Unknown error'
        });
      }
    }

    const summary = {
      totalArchived: archivedSnapshot.size,
      expiredFound: expiredListings.length,
      nonExpiredFound: nonExpiredListings.length,
      totalDeleted,
      totalFavoritesRemoved,
      errors: errors.length,
      errorDetails: errors,
      timestamp: new Date().toISOString(),
      batchesExecuted: batches.length
    };

    console.log('[Force Cleanup Archived] Process completed', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} expired archived listings and removed ${totalFavoritesRemoved} favorite references using ${batches.length} batch operations${errors.length > 0 ? ` (${errors.length} errors occurred)` : ''}`,
      summary
    });
  } catch (error: any) {
    console.error('[Force Cleanup Archived] Fatal error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to clean up archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}