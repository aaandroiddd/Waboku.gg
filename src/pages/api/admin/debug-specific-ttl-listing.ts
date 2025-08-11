import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { listingId } = req.query;
  
  if (!listingId || typeof listingId !== 'string') {
    return res.status(400).json({ error: 'listingId is required' });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const now = new Date();
    
    console.log('[TTL Debug] Starting debug for listing:', listingId);
    
    // Get the specific listing - this is a simple document get, no query
    const listingDoc = await db.collection('listings').doc(listingId).get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listingData = listingDoc.data();
    const deleteAt = listingData?.deleteAt; // Use direct field name instead of config
    
    // Convert timestamps for comparison
    let deleteAtDate = null;
    let archivedAtDate = null;
    
    try {
      deleteAtDate = deleteAt?.toDate ? deleteAt.toDate() : (deleteAt ? new Date(deleteAt) : null);
      archivedAtDate = listingData?.archivedAt?.toDate ? listingData.archivedAt.toDate() : (listingData?.archivedAt ? new Date(listingData.archivedAt) : null);
    } catch (dateError) {
      console.warn('[TTL Debug] Date conversion error:', dateError);
    }
    
    // Check if it should be deleted
    const shouldBeDeleted = deleteAtDate && now > deleteAtDate;
    const timeDiff = deleteAtDate ? now.getTime() - deleteAtDate.getTime() : null;
    
    // Simple timestamp comparison without complex queries
    let wouldBeFoundByCron = false;
    
    if (deleteAt && deleteAtDate) {
      try {
        const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
        const deleteAtTimestamp = deleteAt.toMillis ? deleteAt : admin.firestore.Timestamp.fromDate(deleteAtDate);
        wouldBeFoundByCron = deleteAtTimestamp.toMillis() <= nowTimestamp.toMillis();
      } catch (timestampError) {
        console.warn('[TTL Debug] Timestamp comparison error:', timestampError);
        wouldBeFoundByCron = shouldBeDeleted; // Fallback to simple date comparison
      }
    }
    
    const diagnostics = {
      listingId,
      currentTime: now.toISOString(),
      listing: {
        status: listingData?.status,
        archivedAt: archivedAtDate?.toISOString() || null,
        deleteAt: deleteAtDate?.toISOString() || null,
        ttlReason: listingData?.ttlReason || null,
        ttlSetAt: listingData?.ttlSetAt?.toDate?.()?.toISOString() || null,
        hasDeleteAtField: !!deleteAt,
        deleteAtRawValue: deleteAt?.toString() || null,
        userId: listingData?.userId || null,
        shortId: listingData?.shortId || null
      },
      analysis: {
        shouldBeDeleted,
        timePastDeletion: timeDiff ? `${Math.round(timeDiff / (1000 * 60))} minutes` : null,
        wouldBeFoundByCronJob: wouldBeFoundByCron,
        deleteAtTimestamp: deleteAt?.toMillis?.() || (deleteAtDate ? deleteAtDate.getTime() : null),
        currentTimestamp: now.getTime(),
        ttlFieldName: 'deleteAt'
      },
      cronJobQuery: {
        field: 'deleteAt',
        operator: '<=',
        value: now.toISOString(),
        explanation: 'Cron job finds listings where deleteAt <= current time'
      }
    };
    
    // If manual cleanup is requested
    if (req.method === 'POST' && shouldBeDeleted) {
      try {
        console.log('[TTL Debug] Starting manual deletion for listing:', listingId);
        
        // Use individual deletes instead of batch to avoid any query conflicts
        const deletePromises = [];
        
        // Delete the main listing
        deletePromises.push(listingDoc.ref.delete());
        
        // Clean up related data with proper validation
        if (listingData?.shortId && typeof listingData.shortId === 'string' && listingData.shortId.trim()) {
          const shortIdRef = db.collection('shortIdMappings').doc(listingData.shortId);
          deletePromises.push(shortIdRef.delete().catch(err => {
            console.warn('[TTL Debug] Error deleting shortId mapping:', err);
          }));
        }
        
        if (listingData?.userId && typeof listingData.userId === 'string' && listingData.userId.trim()) {
          // Validate that the userId and listingId are valid Firestore document IDs
          const userIdValid = /^[a-zA-Z0-9_-]+$/.test(listingData.userId);
          const listingIdValid = /^[a-zA-Z0-9_-]+$/.test(listingId);
          
          if (userIdValid && listingIdValid) {
            const userListingRef = db.collection('users').doc(listingData.userId)
              .collection('listings').doc(listingId);
            deletePromises.push(userListingRef.delete().catch(err => {
              console.warn('[TTL Debug] Error deleting user listing reference:', err);
            }));
          } else {
            console.warn('[TTL Debug] Invalid document ID format:', { userId: listingData.userId, listingId });
          }
        }
        
        await Promise.all(deletePromises);
        
        console.log('[TTL Debug] Manual deletion completed for listing:', listingId);
        
        return res.status(200).json({
          ...diagnostics,
          action: 'DELETED',
          message: 'Listing manually deleted due to expired TTL'
        });
      } catch (deleteError) {
        console.error('[TTL Debug] Error during manual deletion:', deleteError);
        return res.status(500).json({
          error: 'Failed to delete listing',
          message: deleteError instanceof Error ? deleteError.message : 'Unknown deletion error'
        });
      }
    }
    
    return res.status(200).json(diagnostics);
    
  } catch (error) {
    console.error('[TTL Debug] Error:', error);
    return res.status(500).json({
      error: 'Failed to debug TTL listing',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}