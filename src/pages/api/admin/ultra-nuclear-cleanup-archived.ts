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

  console.log('[Ultra Nuclear Cleanup] Starting ultra nuclear cleanup with direct admin operations', new Date().toISOString());

  try {
    const { admin, db } = getFirebaseAdmin();
    
    // Verify we have admin privileges by testing a write operation
    console.log('[Ultra Nuclear Cleanup] Testing admin privileges...');
    
    try {
      const testDoc = db.collection('_admin_test').doc('ultra_test');
      await testDoc.set({ test: true, timestamp: new Date() });
      await testDoc.delete();
      console.log('[Ultra Nuclear Cleanup] Admin privileges confirmed');
    } catch (testError: any) {
      console.error('[Ultra Nuclear Cleanup] Admin privileges test failed:', testError);
      return res.status(500).json({
        error: 'Admin privileges verification failed',
        details: testError.message
      });
    }
    
    let totalDeleted = 0;
    let totalFavoritesRemoved = 0;
    let errors = [];

    // Get all archived listings using admin privileges
    const now = new Date();
    console.log('[Ultra Nuclear Cleanup] Querying archived listings...');
    
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Ultra Nuclear Cleanup] Found ${archivedSnapshot.size} total archived listings`);

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
          
          console.log(`[Ultra Nuclear Cleanup] Listing ${doc.id}:`, {
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
          
          console.log(`[Ultra Nuclear Cleanup] Listing ${doc.id} (using expiresAt):`, {
            expiresAt: expiresAt.toISOString(),
            currentTime: now.toISOString(),
            isExpired,
            timeUntilExpiry: Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours'
          });
        } else {
          // If no timestamps, assume it should have been deleted (legacy data)
          expiresAt = new Date(0); // Very old date
          isExpired = true;
          
          console.log(`[Ultra Nuclear Cleanup] Listing ${doc.id} has no timestamps - marking as expired`);
        }

        if (isExpired) {
          expiredListings.push({ doc, data, expiresAt });
        } else {
          nonExpiredListings.push({ doc, data, expiresAt });
        }
      } catch (error) {
        console.error(`[Ultra Nuclear Cleanup] Error parsing timestamps for listing ${doc.id}:`, error);
        // If we can't parse the date, assume it's expired
        expiredListings.push({ doc, data, expiresAt: new Date(0) });
      }
    }

    console.log(`[Ultra Nuclear Cleanup] Analysis:`, {
      totalArchived: archivedSnapshot.size,
      expired: expiredListings.length,
      nonExpired: nonExpiredListings.length,
      currentTime: now.toISOString()
    });

    // Use direct admin operations - NO TRANSACTIONS
    console.log('[Ultra Nuclear Cleanup] Using direct admin operations (no transactions)...');
    
    // Process each expired listing individually
    for (let i = 0; i < expiredListings.length; i++) {
      const { doc, data } = expiredListings[i];
      const listingId = doc.id;
      
      console.log(`[Ultra Nuclear Cleanup] Processing listing ${i + 1}/${expiredListings.length}: ${listingId}`);
      
      try {
        // Step 1: Find and delete all favorites for this listing
        console.log(`[Ultra Nuclear Cleanup] Finding favorites for listing ${listingId}...`);
        
        const favoritesQuery = await db.collectionGroup('favorites')
          .where('listingId', '==', listingId)
          .get();

        console.log(`[Ultra Nuclear Cleanup] Found ${favoritesQuery.size} favorites for listing ${listingId}`);
        
        let favoritesDeletedForThisListing = 0;
        
        // Delete each favorite individually
        for (const favoriteDoc of favoritesQuery.docs) {
          try {
            await favoriteDoc.ref.delete();
            favoritesDeletedForThisListing++;
            console.log(`[Ultra Nuclear Cleanup] Deleted favorite ${favoriteDoc.id} for listing ${listingId}`);
          } catch (favoriteError: any) {
            console.error(`[Ultra Nuclear Cleanup] Failed to delete favorite ${favoriteDoc.id}:`, favoriteError);
            errors.push({
              type: 'favorite_deletion',
              listingId: listingId,
              favoriteId: favoriteDoc.id,
              error: favoriteError.message || favoriteError.toString()
            });
          }
        }
        
        // Step 2: Delete the listing itself
        console.log(`[Ultra Nuclear Cleanup] Deleting listing ${listingId}...`);
        
        await doc.ref.delete();
        
        // Success!
        totalDeleted++;
        totalFavoritesRemoved += favoritesDeletedForThisListing;
        
        console.log(`[Ultra Nuclear Cleanup] Successfully deleted listing ${listingId} and ${favoritesDeletedForThisListing} favorites`);
        
      } catch (listingError: any) {
        console.error(`[Ultra Nuclear Cleanup] Failed to delete listing ${listingId}:`, {
          message: listingError.message,
          code: listingError.code,
          details: listingError.details
        });
        
        errors.push({
          type: 'listing_deletion',
          listingId: listingId,
          error: `${listingError.code || 'UNKNOWN'}: ${listingError.message || listingError.toString()}`
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
      method: 'direct_admin_operations'
    };

    console.log('[Ultra Nuclear Cleanup] Process completed', summary);

    return res.status(200).json({
      message: `Ultra nuclear cleanup completed: ${totalDeleted} expired archived listings deleted and ${totalFavoritesRemoved} favorite references removed using direct admin operations${errors.length > 0 ? ` (${errors.length} errors occurred)` : ''}`,
      summary
    });
  } catch (error: any) {
    console.error('[Ultra Nuclear Cleanup] Fatal error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to perform ultra nuclear cleanup of archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}