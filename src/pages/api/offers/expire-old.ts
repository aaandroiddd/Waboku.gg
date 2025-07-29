import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { addTTLToOffer, OFFER_TTL_CONFIG } from '@/lib/offer-ttl';

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

// Helper function to create a new batch when the current one is full
const createNewBatchIfNeeded = (db: FirebaseFirestore.Firestore, currentBatch: FirebaseFirestore.WriteBatch, operationCount: number) => {
  if (operationCount >= BATCH_SIZE) {
    return db.batch();
  }
  return currentBatch;
};

/**
 * Expires all pending offers that are past their expiresAt timestamp.
 * Now uses TTL for automatic deletion to reduce Firebase usage.
 * 
 * This route is protected by Vercel cron jobs or a manual secret.
 * 
 * Can be triggered by a cron job or manually with the CRON_SECRET.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify that this is a cron job request from Vercel or an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    // This is a Vercel cron job - these are automatically authorized
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Expire Offers] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // This is a manual admin request - check the token
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Expire Offers] Unauthorized access attempt', {
      hasAuth: !!authHeader,
      isVercelCron,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Log the source of the request
  console.log(`[Expire Offers] Request authorized as ${requestType}`);

  // Force console log to ensure visibility in Vercel logs
  console.log('[Expire Offers] Starting automated offer expiration process', {
    timestamp: new Date().toISOString(),
    environment: process.env.NEXT_PUBLIC_CO_DEV_ENV
  });

  try {
    console.log('[Expire Offers] Initializing Firebase Admin');
    getFirebaseAdmin();
    const db = getFirestore();
    let batch = db.batch();
    let batchOperations = 0;
    let totalExpired = 0;
    let completedBatches = 0;

    const now = admin.firestore.Timestamp.now();
    const nowDate = now.toDate();

    // Query all pending offers that have expired
    const expiredOffersSnap = await db.collection('offers')
      .where('status', '==', 'pending')
      .where('expiresAt', '<', now)
      .get();

    console.log(`[Expire Offers] Processing ${expiredOffersSnap.size} expired offers`);

    if (expiredOffersSnap.empty) {
      return res.status(200).json({ 
        message: 'No expired offers found.',
        summary: {
          totalExpired: 0,
          completedBatches: 0,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Process each expired offer with TTL
    expiredOffersSnap.forEach((doc) => {
      try {
        const data = doc.data();
        if (!data) {
          console.warn(`[Expire Offers] Empty offer data for ${doc.id}`);
          return;
        }

        batch = createNewBatchIfNeeded(db, batch, batchOperations);
        
        // Use TTL for automatic deletion - Firestore will handle the deletion
        const ttlData = addTTLToOffer({
          ...data,
          // Store previous state for debugging
          previousStatus: data.status,
          previousExpiresAt: data.expiresAt
        }, nowDate);
        
        batch.update(doc.ref, ttlData);
        
        batchOperations++;
        totalExpired++;
        
        if (batchOperations >= BATCH_SIZE) {
          batch.commit();
          completedBatches++;
          console.log(`[Expire Offers] Committed batch ${completedBatches} with ${batchOperations} operations`);
          batch = db.batch();
          batchOperations = 0;
        }
        
        console.log(`[Expire Offers] Marked offer ${doc.id} for expiration with TTL`, {
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          listingId: data.listingId,
          amount: data.amount,
          expiresAt: data.expiresAt?.toDate?.()?.toISOString(),
          ttlDeleteAt: ttlData[OFFER_TTL_CONFIG.ttlField].toDate().toISOString()
        });
      } catch (error) {
        logError('Processing expired offer', error, {
          offerId: doc.id,
          data: doc.data()
        });
      }
    });

    // Commit any remaining changes
    if (batchOperations > 0) {
      await batch.commit();
      completedBatches++;
      console.log(`[Expire Offers] Committed final batch ${completedBatches} with ${batchOperations} operations`);
    }

    const summary = {
      totalExpired,
      completedBatches,
      timestamp: new Date().toISOString()
    };

    console.log('[Expire Offers] Process completed successfully', summary);

    return res.status(200).json({ 
      message: `Successfully expired ${totalExpired} offers with TTL for automatic deletion`,
      summary
    });
  } catch (error: any) {
    logError('Expire offers', error);
    return res.status(500).json({ 
      error: 'Failed to expire offers',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}