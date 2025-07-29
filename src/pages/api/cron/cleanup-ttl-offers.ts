import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { shouldImmediatelyDeleteOffer, OFFER_TTL_CONFIG } from '@/lib/offer-ttl';

// Maximum number of operations in a single batch
const BATCH_SIZE = 500;

// Helper function to log errors with context
const logError = (context: string, error: any, additionalInfo?: any) => {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo
  });
};

/**
 * Backup cleanup job for TTL offers that Firebase might have missed
 * Runs every 5 minutes to catch any offers that should have been deleted by Firebase TTL
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify that this is a cron job request from Vercel or an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Cleanup TTL Offers] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Cleanup TTL Offers] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log(`[Cleanup TTL Offers] Request authorized as ${requestType}`);

  try {
    console.log('[Cleanup TTL Offers] Starting TTL offer cleanup process');
    const { db } = getFirebaseAdmin();
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);
    
    let totalDeleted = 0;
    let totalProcessed = 0;
    let batchCount = 0;

    // Step 1: Find offers that should have been deleted by Firebase TTL but weren't
    console.log('[Cleanup TTL Offers] Checking for offers that should have been deleted by TTL...');
    
    const expiredOffersWithTTL = await db.collection('offers')
      .where('status', '==', 'expired')
      .where(OFFER_TTL_CONFIG.ttlField, '<', nowTimestamp)
      .limit(BATCH_SIZE)
      .get();

    if (!expiredOffersWithTTL.empty) {
      console.log(`[Cleanup TTL Offers] Found ${expiredOffersWithTTL.size} offers that should have been deleted by TTL`);
      
      const batch = db.batch();
      let batchOperations = 0;

      for (const doc of expiredOffersWithTTL.docs) {
        try {
          const data = doc.data();
          const deleteAt = data[OFFER_TTL_CONFIG.ttlField]?.toDate();
          
          console.log(`[Cleanup TTL Offers] Deleting TTL-expired offer ${doc.id}`, {
            status: data.status,
            deleteAt: deleteAt?.toISOString(),
            buyerId: data.buyerId,
            sellerId: data.sellerId,
            listingId: data.listingId
          });
          
          batch.delete(doc.ref);
          batchOperations++;
          totalDeleted++;
          
          if (batchOperations >= BATCH_SIZE) {
            await batch.commit();
            batchCount++;
            console.log(`[Cleanup TTL Offers] Committed TTL cleanup batch ${batchCount}`);
            break; // Process one batch at a time to avoid timeouts
          }
        } catch (error) {
          logError('Processing TTL-expired offer', error, { offerId: doc.id });
        }
      }

      if (batchOperations > 0) {
        await batch.commit();
        batchCount++;
        console.log(`[Cleanup TTL Offers] Committed final TTL cleanup batch ${batchCount}`);
      }
    }

    // Step 2: Find legacy expired offers without TTL that should be deleted
    console.log('[Cleanup TTL Offers] Checking for legacy expired offers without TTL...');
    
    const legacyExpiredOffers = await db.collection('offers')
      .where('status', '==', 'expired')
      .where(OFFER_TTL_CONFIG.ttlField, '==', null)
      .limit(BATCH_SIZE)
      .get();

    if (!legacyExpiredOffers.empty) {
      console.log(`[Cleanup TTL Offers] Found ${legacyExpiredOffers.size} legacy expired offers without TTL`);
      
      const batch = db.batch();
      let batchOperations = 0;

      for (const doc of legacyExpiredOffers.docs) {
        try {
          const data = doc.data();
          totalProcessed++;
          
          if (shouldImmediatelyDeleteOffer(data)) {
            console.log(`[Cleanup TTL Offers] Deleting legacy expired offer ${doc.id}`, {
              status: data.status,
              updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
              buyerId: data.buyerId,
              sellerId: data.sellerId,
              listingId: data.listingId
            });
            
            batch.delete(doc.ref);
            batchOperations++;
            totalDeleted++;
            
            if (batchOperations >= BATCH_SIZE) {
              await batch.commit();
              batchCount++;
              console.log(`[Cleanup TTL Offers] Committed legacy cleanup batch ${batchCount}`);
              break; // Process one batch at a time
            }
          }
        } catch (error) {
          logError('Processing legacy expired offer', error, { offerId: doc.id });
        }
      }

      if (batchOperations > 0) {
        await batch.commit();
        batchCount++;
        console.log(`[Cleanup TTL Offers] Committed final legacy cleanup batch ${batchCount}`);
      }
    }

    // Step 3: Clean up other completed offers that are old (accepted, declined, cancelled, cleared)
    const completedStatuses = ['accepted', 'declined', 'cancelled'];
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    for (const status of completedStatuses) {
      console.log(`[Cleanup TTL Offers] Checking for old ${status} offers...`);
      
      const oldCompletedOffers = await db.collection('offers')
        .where('status', '==', status)
        .where('updatedAt', '<', thirtyDaysAgoTimestamp)
        .limit(BATCH_SIZE / completedStatuses.length) // Distribute batch size across statuses
        .get();

      if (!oldCompletedOffers.empty) {
        console.log(`[Cleanup TTL Offers] Found ${oldCompletedOffers.size} old ${status} offers`);
        
        const batch = db.batch();
        let batchOperations = 0;

        for (const doc of oldCompletedOffers.docs) {
          try {
            const data = doc.data();
            
            console.log(`[Cleanup TTL Offers] Deleting old ${status} offer ${doc.id}`, {
              status: data.status,
              updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
              buyerId: data.buyerId,
              sellerId: data.sellerId,
              listingId: data.listingId
            });
            
            batch.delete(doc.ref);
            batchOperations++;
            totalDeleted++;
            
            if (batchOperations >= BATCH_SIZE / completedStatuses.length) {
              await batch.commit();
              batchCount++;
              console.log(`[Cleanup TTL Offers] Committed ${status} cleanup batch ${batchCount}`);
              break;
            }
          } catch (error) {
            logError(`Processing old ${status} offer`, error, { offerId: doc.id });
          }
        }

        if (batchOperations > 0) {
          await batch.commit();
          batchCount++;
          console.log(`[Cleanup TTL Offers] Committed final ${status} cleanup batch ${batchCount}`);
        }
      }
    }

    const summary = {
      totalDeleted,
      totalProcessed,
      batchCount,
      timestamp: new Date().toISOString()
    };

    console.log('[Cleanup TTL Offers] Cleanup process completed', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} offers`,
      summary
    });
  } catch (error: any) {
    logError('TTL offer cleanup', error);
    return res.status(500).json({
      error: 'Failed to cleanup TTL offers',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}