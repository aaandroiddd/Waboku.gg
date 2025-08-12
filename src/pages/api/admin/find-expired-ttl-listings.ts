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

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const now = new Date();
    
    console.log('[Find Expired TTL] Starting search for expired listings');
    
    // Find all listings with deleteAt field that should be expired
    const expiredQuery = await db.collection('listings')
      .where('deleteAt', '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(100) // Limit to prevent overwhelming response
      .get();

    console.log(`[Find Expired TTL] Found ${expiredQuery.size} listings with expired deleteAt`);

    const expiredListings = [];
    
    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data.deleteAt;
      
      let deleteAtDate = null;
      let archivedAtDate = null;
      
      try {
        deleteAtDate = deleteAt?.toDate ? deleteAt.toDate() : (deleteAt ? new Date(deleteAt) : null);
        archivedAtDate = data?.archivedAt?.toDate ? data.archivedAt.toDate() : (data?.archivedAt ? new Date(data.archivedAt) : null);
      } catch (dateError) {
        console.warn('[Find Expired TTL] Date conversion error for listing:', doc.id, dateError);
      }
      
      const timePastDeletion = deleteAtDate ? now.getTime() - deleteAtDate.getTime() : null;
      const minutesPastDeletion = timePastDeletion ? Math.round(timePastDeletion / (1000 * 60)) : null;
      
      expiredListings.push({
        id: doc.id,
        status: data.status,
        archivedAt: archivedAtDate?.toISOString() || null,
        deleteAt: deleteAtDate?.toISOString() || null,
        ttlReason: data.ttlReason || null,
        ttlSetAt: data.ttlSetAt?.toDate?.()?.toISOString() || null,
        userId: data.userId || null,
        shortId: data.shortId || null,
        minutesPastDeletion,
        deleteAtTimestamp: deleteAt?.toMillis?.() || (deleteAtDate ? deleteAtDate.getTime() : null)
      });
    }
    
    // Sort by most overdue first
    expiredListings.sort((a, b) => (b.minutesPastDeletion || 0) - (a.minutesPastDeletion || 0));
    
    // Also check for archived listings without deleteAt field (potential migration issues)
    const archivedWithoutTTLQuery = await db.collection('listings')
      .where('status', '==', 'archived')
      .limit(50)
      .get();
    
    const archivedWithoutTTL = [];
    
    for (const doc of archivedWithoutTTLQuery.docs) {
      const data = doc.data();
      
      if (!data.deleteAt) {
        let archivedAtDate = null;
        
        try {
          archivedAtDate = data?.archivedAt?.toDate ? data.archivedAt.toDate() : (data?.archivedAt ? new Date(data.archivedAt) : null);
        } catch (dateError) {
          console.warn('[Find Expired TTL] Date conversion error for archived listing:', doc.id, dateError);
        }
        
        const archiveAge = archivedAtDate ? now.getTime() - archivedAtDate.getTime() : null;
        const daysArchived = archiveAge ? Math.round(archiveAge / (1000 * 60 * 60 * 24)) : null;
        
        archivedWithoutTTL.push({
          id: doc.id,
          status: data.status,
          archivedAt: archivedAtDate?.toISOString() || null,
          daysArchived,
          userId: data.userId || null,
          shortId: data.shortId || null,
          hasDeleteAtField: false
        });
      }
    }
    
    const result = {
      currentTime: now.toISOString(),
      summary: {
        totalExpiredListings: expiredListings.length,
        totalArchivedWithoutTTL: archivedWithoutTTL.length,
        mostOverdueMinutes: expiredListings.length > 0 ? expiredListings[0].minutesPastDeletion : 0
      },
      expiredListings: expiredListings.slice(0, 20), // Show top 20 most overdue
      archivedWithoutTTL: archivedWithoutTTL.slice(0, 10), // Show first 10
      cronJobQuery: {
        field: 'deleteAt',
        operator: '<=',
        value: now.toISOString(),
        explanation: 'This is the exact query the cron job uses to find expired listings'
      },
      possibleIssues: [
        'Cron job query not matching these listings',
        'Batch processing limitations (500 item limit)',
        'Firestore eventual consistency issues',
        'Error during batch deletion process',
        'TTL field migration incomplete'
      ]
    };
    
    console.log('[Find Expired TTL] Search completed', {
      expiredCount: expiredListings.length,
      archivedWithoutTTLCount: archivedWithoutTTL.length
    });
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[Find Expired TTL] Error:', error);
    return res.status(500).json({
      error: 'Failed to find expired TTL listings',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}