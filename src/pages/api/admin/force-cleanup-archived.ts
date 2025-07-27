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

  console.log('[Force Cleanup Archived] Starting simplified cleanup process', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    
    let totalDeleted = 0;
    let totalFavoritesRemoved = 0;
    let errors = [];

    // Get all archived listings
    const now = new Date();
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
        if (data.expiresAt) {
          expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        } else {
          // If no expiresAt, assume it should have been deleted (legacy data)
          expiresAt = new Date(0); // Very old date
        }

        isExpired = now > expiresAt;

        if (isExpired) {
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

    // Process expired listings one by one for better error handling
    for (const { doc, data } of expiredListings) {
      try {
        const listingId = doc.id;
        console.log(`[Force Cleanup Archived] Processing listing ${listingId}...`);

        // Find all users who have this listing in their favorites
        const favoritesQuery = await db.collectionGroup('favorites')
          .where('listingId', '==', listingId)
          .get();

        console.log(`[Force Cleanup Archived] Found ${favoritesQuery.size} favorites for listing ${listingId}`);

        // Delete the listing first
        await doc.ref.delete();
        totalDeleted++;
        console.log(`[Force Cleanup Archived] Deleted listing ${listingId}`);

        // Delete all favorites referencing this listing
        for (const favoriteDoc of favoritesQuery.docs) {
          try {
            await favoriteDoc.ref.delete();
            totalFavoritesRemoved++;
          } catch (favoriteError) {
            console.error(`[Force Cleanup Archived] Error deleting favorite ${favoriteDoc.id}:`, favoriteError);
            errors.push({
              type: 'favorite_deletion',
              listingId,
              favoriteId: favoriteDoc.id,
              error: favoriteError.message
            });
          }
        }

        console.log(`[Force Cleanup Archived] Successfully processed listing ${listingId}`, {
          userId: data.userId,
          archivedAt: data.archivedAt?.toDate?.()?.toISOString() || 'unknown',
          expiresAt: data.expiresAt?.toDate?.()?.toISOString() || 'unknown',
          favoritesRemoved: favoritesQuery.size
        });

      } catch (error) {
        console.error(`[Force Cleanup Archived] Error processing listing ${doc.id}:`, error);
        errors.push({
          type: 'listing_deletion',
          listingId: doc.id,
          error: error.message
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
      timestamp: new Date().toISOString()
    };

    console.log('[Force Cleanup Archived] Process completed', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} expired archived listings and removed ${totalFavoritesRemoved} favorite references${errors.length > 0 ? ` (${errors.length} errors occurred)` : ''}`,
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