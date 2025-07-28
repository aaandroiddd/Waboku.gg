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

  console.log('[Nuclear Cleanup Archived] Starting nuclear cleanup process with maximum admin privileges', new Date().toISOString());

  try {
    const { admin, db } = getFirebaseAdmin();
    
    // Verify we have admin privileges by testing a write operation
    console.log('[Nuclear Cleanup Archived] Testing admin privileges...');
    
    try {
      const testDoc = db.collection('_admin_test').doc('test');
      await testDoc.set({ test: true, timestamp: new Date() });
      await testDoc.delete();
      console.log('[Nuclear Cleanup Archived] Admin privileges confirmed');
    } catch (testError: any) {
      console.error('[Nuclear Cleanup Archived] Admin privileges test failed:', testError);
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
    console.log('[Nuclear Cleanup Archived] Querying archived listings...');
    
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Nuclear Cleanup Archived] Found ${archivedSnapshot.size} total archived listings`);

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
          
          console.log(`[Nuclear Cleanup Archived] Listing ${doc.id}:`, {
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
          
          console.log(`[Nuclear Cleanup Archived] Listing ${doc.id} (using expiresAt):`, {
            expiresAt: expiresAt.toISOString(),
            currentTime: now.toISOString(),
            isExpired,
            timeUntilExpiry: Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours'
          });
        } else {
          // If no timestamps, assume it should have been deleted (legacy data)
          expiresAt = new Date(0); // Very old date
          isExpired = true;
          
          console.log(`[Nuclear Cleanup Archived] Listing ${doc.id} has no timestamps - marking as expired`);
        }

        if (isExpired) {
          expiredListings.push({ doc, data, expiresAt });
        } else {
          nonExpiredListings.push({ doc, data, expiresAt });
        }
      } catch (error) {
        console.error(`[Nuclear Cleanup Archived] Error parsing timestamps for listing ${doc.id}:`, error);
        // If we can't parse the date, assume it's expired
        expiredListings.push({ doc, data, expiresAt: new Date(0) });
      }
    }

    console.log(`[Nuclear Cleanup Archived] Analysis:`, {
      totalArchived: archivedSnapshot.size,
      expired: expiredListings.length,
      nonExpired: nonExpiredListings.length,
      currentTime: now.toISOString()
    });

    // Use a different approach - direct admin operations with runTransaction
    console.log('[Nuclear Cleanup Archived] Using runTransaction for nuclear deletion...');
    
    // Process in smaller chunks to avoid transaction limits
    const chunkSize = 10; // Smaller chunks for transactions
    
    for (let i = 0; i < expiredListings.length; i += chunkSize) {
      const chunk = expiredListings.slice(i, i + chunkSize);
      
      console.log(`[Nuclear Cleanup Archived] Processing chunk ${Math.floor(i / chunkSize) + 1} with ${chunk.length} listings`);
      
      try {
        await db.runTransaction(async (transaction) => {
          console.log(`[Nuclear Cleanup Archived] Starting transaction for chunk ${Math.floor(i / chunkSize) + 1}`);
          
          // First, collect all favorites for these listings
          const favoritesToDelete = [];
          
          for (const { doc } of chunk) {
            const listingId = doc.id;
            
            // Find all users who have this listing in their favorites
            const favoritesQuery = await db.collectionGroup('favorites')
              .where('listingId', '==', listingId)
              .get();

            console.log(`[Nuclear Cleanup Archived] Found ${favoritesQuery.size} favorites for listing ${listingId}`);
            
            for (const favoriteDoc of favoritesQuery.docs) {
              favoritesToDelete.push(favoriteDoc.ref);
            }
          }
          
          // Delete all favorites first
          for (const favoriteRef of favoritesToDelete) {
            transaction.delete(favoriteRef);
          }
          
          // Then delete all listings in this chunk
          for (const { doc } of chunk) {
            transaction.delete(doc.ref);
          }
          
          console.log(`[Nuclear Cleanup Archived] Transaction prepared: ${chunk.length} listings, ${favoritesToDelete.length} favorites`);
        });
        
        // If we get here, the transaction succeeded
        totalDeleted += chunk.length;
        
        // Count favorites for this chunk
        for (const { doc } of chunk) {
          const listingId = doc.id;
          const favoritesQuery = await db.collectionGroup('favorites')
            .where('listingId', '==', listingId)
            .get();
          totalFavoritesRemoved += favoritesQuery.size;
        }
        
        console.log(`[Nuclear Cleanup Archived] Successfully processed chunk ${Math.floor(i / chunkSize) + 1}`);
        
      } catch (transactionError: any) {
        console.error(`[Nuclear Cleanup Archived] Transaction failed for chunk ${Math.floor(i / chunkSize) + 1}:`, {
          message: transactionError.message,
          code: transactionError.code,
          details: transactionError.details
        });
        
        // Add individual errors for each listing in the failed chunk
        for (const { doc } of chunk) {
          errors.push({
            type: 'transaction_deletion',
            listingId: doc.id,
            error: `Transaction failed: ${transactionError.code || transactionError.message}`
          });
        }
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
      chunksProcessed: Math.ceil(expiredListings.length / chunkSize),
      method: 'runTransaction'
    };

    console.log('[Nuclear Cleanup Archived] Process completed', summary);

    return res.status(200).json({
      message: `Nuclear cleanup completed: ${totalDeleted} expired archived listings deleted and ${totalFavoritesRemoved} favorite references removed using ${Math.ceil(expiredListings.length / chunkSize)} transactions${errors.length > 0 ? ` (${errors.length} errors occurred)` : ''}`,
      summary
    });
  } catch (error: any) {
    console.error('[Nuclear Cleanup Archived] Fatal error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to perform nuclear cleanup of archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}