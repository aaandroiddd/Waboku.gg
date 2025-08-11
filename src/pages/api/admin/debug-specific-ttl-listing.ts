import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

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
    
    // Get the specific listing
    const listingDoc = await db.collection('listings').doc(listingId).get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listingData = listingDoc.data();
    const deleteAt = listingData?.[LISTING_TTL_CONFIG.ttlField];
    
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
    
    // Simple check if this listing would be found by the cron job
    // Instead of running a complex query, we'll just check the timestamp logic
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
        deleteAtRawValue: deleteAt?.toString() || null
      },
      analysis: {
        shouldBeDeleted,
        timePastDeletion: timeDiff ? `${Math.round(timeDiff / (1000 * 60))} minutes` : null,
        wouldBeFoundByCronJob: wouldBeFoundByCron,
        deleteAtTimestamp: deleteAt?.toMillis?.() || (deleteAtDate ? deleteAtDate.getTime() : null),
        currentTimestamp: now.getTime(),
        ttlFieldName: LISTING_TTL_CONFIG.ttlField
      },
      cronJobQuery: {
        field: LISTING_TTL_CONFIG.ttlField,
        operator: '<=',
        value: now.toISOString(),
        explanation: 'Cron job finds listings where deleteAt <= current time'
      }
    };
    
    // If manual cleanup is requested
    if (req.method === 'POST' && shouldBeDeleted) {
      const batch = db.batch();
      
      // Delete the main listing
      batch.delete(listingDoc.ref);
      
      // Clean up related data
      if (listingData?.shortId && typeof listingData.shortId === 'string' && listingData.shortId.trim()) {
        const shortIdRef = db.collection('shortIdMappings').doc(listingData.shortId);
        batch.delete(shortIdRef);
      }
      
      if (listingData?.userId && typeof listingData.userId === 'string' && listingData.userId.trim() && 
          listingId && typeof listingId === 'string' && listingId.trim()) {
        const userListingRef = db.collection('users').doc(listingData.userId)
          .collection('listings').doc(listingId);
        batch.delete(userListingRef);
      }
      
      await batch.commit();
      
      return res.status(200).json({
        ...diagnostics,
        action: 'DELETED',
        message: 'Listing manually deleted due to expired TTL'
      });
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