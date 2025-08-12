import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Test the TTL cron job logic manually to debug why it's not working
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[TTL Cron Test] Starting manual TTL cron job test');

  try {
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      return res.status(500).json({ error: 'Firestore not available' });
    }
    
    const db = admin.firestore();
    const now = new Date();
    
    console.log('[TTL Cron Test] Current time:', now.toISOString());
    console.log('[TTL Cron Test] TTL field:', LISTING_TTL_CONFIG.ttlField);
    
    // First, let's see what the query looks like
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    console.log('[TTL Cron Test] Query timestamp:', nowTimestamp.toDate().toISOString());
    
    // Find all listings with expired TTL
    console.log('[TTL Cron Test] Executing query...');
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', nowTimestamp)
      .limit(10) // Limit for testing
      .get();

    console.log(`[TTL Cron Test] Query completed. Found ${expiredQuery.size} expired listings`);

    const results = [];
    
    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      
      const listingInfo = {
        id: doc.id,
        status: data.status,
        deleteAt: deleteAt?.toDate?.()?.toISOString() || deleteAt,
        ttlReason: data.ttlReason,
        archivedAt: data.archivedAt?.toDate?.()?.toISOString() || data.archivedAt,
        userId: data.userId,
        shortId: data.shortId,
        minutesPastDeletion: deleteAt ? Math.round((now.getTime() - deleteAt.toDate().getTime()) / (1000 * 60)) : null
      };
      
      console.log(`[TTL Cron Test] Found expired listing:`, listingInfo);
      results.push(listingInfo);
    }

    // Let's also check if there are any listings with the TTL field at all
    const allTTLQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '>', admin.firestore.Timestamp.fromDate(new Date(0)))
      .limit(5)
      .get();
    
    console.log(`[TTL Cron Test] Found ${allTTLQuery.size} listings with TTL field`);
    
    const ttlListings = [];
    for (const doc of allTTLQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      
      ttlListings.push({
        id: doc.id,
        status: data.status,
        deleteAt: deleteAt?.toDate?.()?.toISOString() || deleteAt,
        isExpired: deleteAt ? now > deleteAt.toDate() : false
      });
    }

    // Test if we can actually perform a deletion (dry run)
    let canDelete = false;
    let deleteError = null;
    
    if (expiredQuery.size > 0) {
      try {
        const testDoc = expiredQuery.docs[0];
        // Just test if we can create a batch operation (don't actually commit)
        const batch = db.batch();
        batch.delete(testDoc.ref);
        canDelete = true;
        console.log('[TTL Cron Test] Batch deletion test passed');
      } catch (error) {
        deleteError = error instanceof Error ? error.message : 'Unknown error';
        console.error('[TTL Cron Test] Batch deletion test failed:', error);
      }
    }

    const response = {
      currentTime: now.toISOString(),
      ttlField: LISTING_TTL_CONFIG.ttlField,
      queryTimestamp: nowTimestamp.toDate().toISOString(),
      expiredListingsFound: expiredQuery.size,
      expiredListings: results,
      totalTTLListings: allTTLQuery.size,
      sampleTTLListings: ttlListings,
      canDelete,
      deleteError,
      firestoreAvailable: !!admin.firestore,
      adminInitialized: !!admin
    };

    console.log('[TTL Cron Test] Test completed:', response);

    return res.status(200).json(response);

  } catch (error) {
    console.error('[TTL Cron Test] Error during test:', error);
    return res.status(500).json({
      error: 'Failed to test TTL cron job',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}