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

  console.log('[Manual Cleanup Specific] Starting enhanced manual cleanup for specific expired listing', new Date().toISOString());

  try {
    // Enhanced Firebase Admin SDK initialization with detailed error checking
    console.log('[Manual Cleanup Specific] Attempting to initialize Firebase Admin SDK...');
    
    let admin, db;
    try {
      const firebaseResult = getFirebaseAdmin();
      console.log('[Manual Cleanup Specific] Firebase Admin result:', {
        hasAdmin: !!firebaseResult?.admin,
        hasDb: !!firebaseResult?.db,
        hasAuth: !!firebaseResult?.auth,
        hasStorage: !!firebaseResult?.storage,
        hasDatabase: !!firebaseResult?.database
      });
      
      if (!firebaseResult || !firebaseResult.admin) {
        throw new Error('Firebase Admin instance not available');
      }
      
      admin = firebaseResult.admin;
      db = firebaseResult.db;
      
      if (!db) {
        console.log('[Manual Cleanup Specific] Attempting to get Firestore directly from admin...');
        db = admin.firestore();
      }
      
      if (!db) {
        throw new Error('Firestore instance not available');
      }
      
      console.log('[Manual Cleanup Specific] Firebase Admin SDK initialized successfully');
      
    } catch (initError: any) {
      console.error('[Manual Cleanup Specific] Firebase Admin SDK initialization failed:', {
        message: initError.message,
        stack: initError.stack?.split('\n').slice(0, 3).join('\n'),
        name: initError.name,
        code: initError.code
      });
      
      return res.status(500).json({ 
        error: 'Firebase Admin SDK initialization failed',
        details: initError.message,
        timestamp: new Date().toISOString(),
        environmentCheck: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0
        }
      });
    }
    const now = new Date();
    
    // Target the specific listing ID from the screenshot: NOlBNyOhmrqwr9QGHuze
    const listingId = 'NOlBNyOhmrqwr9QGHuze';
    
    console.log(`[Manual Cleanup Specific] Checking listing ${listingId} with enhanced Firebase Admin SDK approach`);
    
    // Get the specific listing using Firebase Admin SDK (should bypass security rules)
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ 
        error: 'Listing not found',
        listingId,
        timestamp: now.toISOString()
      });
    }
    
    const listingData = listingDoc.data();
    if (!listingData) {
      return res.status(404).json({ 
        error: 'Listing data is empty',
        listingId,
        timestamp: now.toISOString()
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
    
    // Find all favorites for this listing using collectionGroup query
    console.log(`[Manual Cleanup Specific] Searching for favorites with listingId: ${listingId}`);
    const favoritesQuery = await db.collectionGroup('favorites')
      .where('listingId', '==', listingId)
      .get();
    
    console.log(`[Manual Cleanup Specific] Found ${favoritesQuery.size} favorites to delete`);
    
    // Enhanced deletion approach: Use individual operations instead of batch to avoid potential issues
    const deletionResults = {
      listingDeleted: false,
      favoritesDeleted: 0,
      errors: []
    };
    
    try {
      // Delete all favorites first (individual operations)
      for (const favoriteDoc of favoritesQuery.docs) {
        try {
          await favoriteDoc.ref.delete();
          deletionResults.favoritesDeleted++;
          console.log(`[Manual Cleanup Specific] Deleted favorite: ${favoriteDoc.id}`);
        } catch (favoriteError: any) {
          console.error(`[Manual Cleanup Specific] Error deleting favorite ${favoriteDoc.id}:`, favoriteError);
          deletionResults.errors.push(`Favorite ${favoriteDoc.id}: ${favoriteError.message}`);
        }
      }
      
      // Delete the listing last
      await listingRef.delete();
      deletionResults.listingDeleted = true;
      console.log(`[Manual Cleanup Specific] Successfully deleted listing: ${listingId}`);
      
    } catch (deleteError: any) {
      console.error(`[Manual Cleanup Specific] Error during deletion:`, {
        message: deleteError.message,
        code: deleteError.code,
        stack: deleteError.stack
      });
      
      deletionResults.errors.push(`Listing deletion: ${deleteError.message}`);
      
      // If listing deletion failed, return the error details
      return res.status(500).json({
        error: 'Failed to delete listing',
        details: deleteError.message,
        code: deleteError.code,
        listingId,
        partialResults: deletionResults,
        timestamp: now.toISOString()
      });
    }
    
    const summary = {
      listingId,
      listingDeleted: deletionResults.listingDeleted,
      favoritesDeleted: deletionResults.favoritesDeleted,
      errors: deletionResults.errors,
      reason,
      timestamp: now.toISOString(),
      method: 'individual_operations'
    };
    
    console.log('[Manual Cleanup Specific] Cleanup completed', summary);
    
    if (deletionResults.errors.length > 0) {
      return res.status(207).json({
        message: `Partially successful: deleted listing and ${deletionResults.favoritesDeleted} favorites with ${deletionResults.errors.length} errors`,
        summary
      });
    }
    
    return res.status(200).json({
      message: `Successfully deleted expired listing ${listingId} and ${deletionResults.favoritesDeleted} associated favorites`,
      summary
    });
    
  } catch (error: any) {
    console.error('[Manual Cleanup Specific] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to cleanup specific listing',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}