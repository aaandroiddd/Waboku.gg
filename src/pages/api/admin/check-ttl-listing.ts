import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG, getTTLStatus } from '@/lib/listing-ttl';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Admin auth check
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
    
    if (!admin.firestore) {
      return res.status(500).json({ error: 'Firestore not available' });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    // Check if listing exists
    const listingDoc = await db.collection('listings').doc(listingId).get();
    
    if (!listingDoc.exists) {
      return res.status(200).json({
        listingId,
        exists: false,
        message: 'Listing has been deleted (TTL worked!)',
        currentTime: now.toISOString()
      });
    }

    const listingData = listingDoc.data();
    const ttlStatus = getTTLStatus(listingData);
    
    // Check if it should be deleted by now
    const deleteAtField = listingData?.[LISTING_TTL_CONFIG.ttlField];
    let deleteAtDate = null;
    
    if (deleteAtField) {
      if (deleteAtField.toDate) {
        deleteAtDate = deleteAtField.toDate();
      } else if (typeof deleteAtField === 'string') {
        deleteAtDate = new Date(deleteAtField);
      } else if (deleteAtField instanceof Date) {
        deleteAtDate = deleteAtField;
      }
    }

    const shouldBeDeleted = deleteAtDate && now > deleteAtDate;
    const timeSinceExpiry = deleteAtDate ? now.getTime() - deleteAtDate.getTime() : null;
    
    // Also check if there are any expired listings in the collection
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(10)
      .get();

    const expiredListings = expiredQuery.docs.map(doc => ({
      id: doc.id,
      deleteAt: doc.data()[LISTING_TTL_CONFIG.ttlField]?.toDate?.()?.toISOString(),
      status: doc.data().status,
      ttlReason: doc.data().ttlReason
    }));

    return res.status(200).json({
      listingId,
      exists: true,
      currentTime: now.toISOString(),
      listing: {
        status: listingData?.status,
        archivedAt: listingData?.archivedAt?.toDate?.()?.toISOString(),
        ttlSetAt: listingData?.ttlSetAt?.toDate?.()?.toISOString(),
        ttlReason: listingData?.ttlReason,
        [LISTING_TTL_CONFIG.ttlField]: deleteAtDate?.toISOString(),
      },
      ttlStatus,
      shouldBeDeleted,
      timeSinceExpiry: timeSinceExpiry ? `${Math.round(timeSinceExpiry / 1000)} seconds` : null,
      ttlConfig: LISTING_TTL_CONFIG,
      expiredListingsInDb: {
        count: expiredQuery.size,
        examples: expiredListings
      },
      diagnosis: {
        ttlPolicyConfigured: true,
        listingHasTTLField: !!deleteAtField,
        ttlFieldType: typeof deleteAtField,
        isFirestoreTimestamp: !!deleteAtField?.toDate,
        shouldBeDeletedByTTL: shouldBeDeleted,
        possibleIssues: [
          !deleteAtField && 'Missing TTL field',
          !deleteAtField?.toDate && deleteAtField && 'TTL field is not a Firestore Timestamp',
          shouldBeDeleted && 'TTL policy may have delays (normal behavior)',
          expiredQuery.size > 0 && 'Multiple expired listings exist - TTL policy may not be working'
        ].filter(Boolean)
      }
    });

  } catch (error) {
    console.error('[Check TTL Listing] Error:', error);
    return res.status(500).json({
      error: 'Failed to check TTL listing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}