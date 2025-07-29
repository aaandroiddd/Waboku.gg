import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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
 * Cleanup job for very old offers (30+ days)
 * This keeps expired offers visible for users but eventually cleans up old data
 * Runs daily to clean up offers older than 30 days
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
    console.log('[Cleanup Old Offers] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Cleanup Old Offers] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log(`[Cleanup Old Offers] Request authorized as ${requestType}`);

  try {
    console.log('[Cleanup Old Offers] Starting old offer cleanup process');
    const { db } = getFirebaseAdmin();
    const now = new Date();
    
    // Clean up offers older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
    
    let totalDeleted = 0;
    let batchCount = 0;

    // Clean up all offers (regardless of status) that are older than 30 days
    console.log('[Cleanup Old Offers] Checking for offers older than 30 days...');
    
    const oldOffers = await db.collection('offers')
      .where('updatedAt', '<', thirtyDaysAgoTimestamp)
      .limit(BATCH_SIZE)
      .get();

    if (!oldOffers.empty) {
      console.log(`[Cleanup Old Offers] Found ${oldOffers.size} offers older than 30 days`);
      
      const batch = db.batch();
      let batchOperations = 0;

      for (const doc of oldOffers.docs) {
        try {
          const data = doc.data();
          
          console.log(`[Cleanup Old Offers] Deleting old offer ${doc.id}`, {
            status: data.status,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
            createdAt: data.createdAt?.toDate?.()?.toISOString(),
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
            console.log(`[Cleanup Old Offers] Committed cleanup batch ${batchCount}`);
            break; // Process one batch at a time to avoid timeouts
          }
        } catch (error) {
          logError('Processing old offer', error, { offerId: doc.id });
        }
      }

      if (batchOperations > 0) {
        await batch.commit();
        batchCount++;
        console.log(`[Cleanup Old Offers] Committed final cleanup batch ${batchCount}`);
      }
    }

    const summary = {
      totalDeleted,
      batchCount,
      cleanupAge: '30 days',
      timestamp: new Date().toISOString()
    };

    console.log('[Cleanup Old Offers] Cleanup process completed', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalDeleted} old offers`,
      summary
    });
  } catch (error: any) {
    logError('Old offer cleanup', error);
    return res.status(500).json({
      error: 'Failed to cleanup old offers',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}