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

  console.log('[Manual Cleanup Specific] Starting manual cleanup for specific expired listing', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    const now = new Date();
    
    // Target the specific listing ID from the screenshot: NOlBNyOhmrqwr9QGHuze
    const listingId = 'NOlBNyOhmrqwr9QGHuze';
    
    console.log(`[Manual Cleanup Specific] Checking listing ${listingId}`);
    
    // Get the specific listing
    const listingDoc = await db.collection('listings').doc(listingId).get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ 
        error: 'Listing not found',
        listingId 
      });
    }
    
    const listingData = listingDoc.data();
    if (!listingData) {
      return res.status(404).json({ 
        error: 'Listing data is empty',
        listingId 
      });
    }
    
    console.log(`[Manual Cleanup Specific] Found listing:`, {
      id: listingId,
      status: listingData.status,
      archivedAt: listingData.archivedAt?.toDate?.()?.toISOString() || 'N/A',
      expiresAt: listingData.expiresAt?.toDate?.()?.toISOString() || 'N/A',
      userId: listingData.userId,
      title: listingData.title
    });
    
    // Check if it should be deleted
    let shouldDelete = false;
    let reason = '';
    
    if (listingData.status === 'archived') {
      if (listingData.archivedAt) {
        const archivedDate = listingData.archivedAt.toDate();
        const archiveExpiresAt = new Date(archivedDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        shouldDelete = now > archiveExpiresAt;
        reason = `Archived on ${archivedDate.toISOString()}, should expire on ${archiveExpiresAt.toISOString()}`;
      } else if (listingData.expiresAt) {
        const expiresAt = listingData.expiresAt.toDate();
        shouldDelete = now > expiresAt;
        reason = `Using expiresAt: ${expiresAt.toISOString()}`;
      }
    }
    
    console.log(`[Manual Cleanup Specific] Analysis:`, {
      shouldDelete,
      reason,
      currentTime: now.toISOString()
    });
    
    if (!shouldDelete) {
      return res.status(200).json({
        message: 'Listing is not expired yet',
        listingId,
        analysis: { shouldDelete, reason, currentTime: now.toISOString() }
      });
    }
    
    // Find all favorites for this listing
    const favoritesQuery = await db.collectionGroup('favorites')
      .where('listingId', '==', listingId)
      .get();
    
    console.log(`[Manual Cleanup Specific] Found ${favoritesQuery.size} favorites to delete`);
    
    // Use a batch to delete everything
    const batch = db.batch();
    
    // Delete the listing
    batch.delete(listingDoc.ref);
    
    // Delete all favorites
    favoritesQuery.docs.forEach(favoriteDoc => {
      batch.delete(favoriteDoc.ref);
    });
    
    // Commit the batch
    await batch.commit();
    
    const summary = {
      listingId,
      listingDeleted: true,
      favoritesDeleted: favoritesQuery.size,
      reason,
      timestamp: now.toISOString()
    };
    
    console.log('[Manual Cleanup Specific] Successfully deleted expired listing', summary);
    
    return res.status(200).json({
      message: `Successfully deleted expired listing ${listingId} and ${favoritesQuery.size} associated favorites`,
      summary
    });
    
  } catch (error: any) {
    console.error('[Manual Cleanup Specific] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to cleanup specific listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}