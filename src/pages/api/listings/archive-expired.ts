import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify that this is a cron job request from Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[Archive Expired] Unauthorized access attempt', {
      providedAuth: authHeader,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Force console log to ensure visibility in Vercel logs
  console.log('[Archive Expired] Starting automated archival process', {
    timestamp: new Date().toISOString(),
    environment: process.env.NEXT_PUBLIC_CO_DEV_ENV
  });
  
  try {
    console.log('[Archive Expired] Initializing Firebase Admin');
    const { db } = getFirebaseAdmin();
    let batch = db.batch();
    let batchOperations = 0;
    let totalArchived = 0;
    let totalDeleted = 0;
    let completedBatches = 0;
    
    // Step 1: Archive expired active listings
    const activeListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    console.log(`[Archive Expired] Processing ${activeListingsSnapshot.size} active listings`);
    
    const processPromises = activeListingsSnapshot.docs.map(async (doc) => {
      try {
        const data = doc.data();
        if (!data) {
          console.warn(`[Archive Expired] Empty listing data for ${doc.id}`);
          return;
        }

        const createdAt = data.createdAt?.toDate() || new Date();
        const userRef = db.collection('users').doc(data.userId);
        const userDoc = await userRef.get();
        
        const userData = userDoc.data();
        if (!userData) {
          console.warn(`[Archive Expired] No user data found for listing ${doc.id}, userId: ${data.userId}`);
          return;
        }
        
        const accountTier = userData.accountTier || 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        if (new Date() > expirationTime) {
          batch = createNewBatchIfNeeded(db, batch, batchOperations);
          
          const now = Timestamp.now();
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: now,
            originalCreatedAt: data.createdAt,
            expirationReason: 'tier_duration_exceeded',
            expiresAt: Timestamp.fromDate(sevenDaysFromNow),
            // Store previous state
            previousStatus: data.status,
            previousExpiresAt: data.expiresAt
          });
          
          batchOperations++;
          totalArchived++;
          
          if (batchOperations >= BATCH_SIZE) {
            await batch.commit();
            completedBatches++;
            console.log(`[Archive Expired] Committed batch ${completedBatches} with ${batchOperations} operations`);
            batch = db.batch();
            batchOperations = 0;
          }
          
          console.log(`[Archive Expired] Marked listing ${doc.id} for archival`, {
            userId: data.userId,
            accountTier,
            createdAt: createdAt.toISOString(),
            expirationTime: expirationTime.toISOString()
          });
        }
      } catch (error) {
        logError('Processing active listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });

    await Promise.all(processPromises);

    // Step 2: Archive inactive listings older than 7 days
    const inactiveSnapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .get();

    console.log(`[Archive Expired] Processing ${inactiveSnapshot.size} inactive listings`);

    inactiveSnapshot.docs.forEach((doc) => {
      try {
        const data = doc.data();
        if (!data) {
          console.warn(`[Archive Expired] Empty inactive listing data for ${doc.id}`);
          return;
        }

        batch = createNewBatchIfNeeded(db, batch, batchOperations);
        
        const now = Timestamp.now();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        batch.update(doc.ref, {
          status: 'archived',
          archivedAt: now,
          originalCreatedAt: data.createdAt,
          expirationReason: 'inactive_timeout',
          expiresAt: Timestamp.fromDate(sevenDaysFromNow)
        });
        
        batchOperations++;
        totalArchived++;
        
        if (batchOperations >= BATCH_SIZE) {
          batch.commit();
          completedBatches++;
          console.log(`[Archive Expired] Committed batch ${completedBatches} with ${batchOperations} operations`);
          batch = db.batch();
          batchOperations = 0;
        }
        
        console.log(`[Archive Expired] Marked inactive listing ${doc.id} for archival`, {
          userId: data.userId,
          updatedAt: data.updatedAt?.toDate().toISOString()
        });
      } catch (error) {
        logError('Processing inactive listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });

    // Removed deletion of archived listings as it's handled by cleanup-archived.ts
    
    // Commit any remaining changes
    if (batchOperations > 0) {
      await batch.commit();
      completedBatches++;
      console.log(`[Archive Expired] Committed final batch ${completedBatches} with ${batchOperations} operations`);
    }

    const summary = {
      totalArchived,
      totalDeleted,
      completedBatches,
      timestamp: new Date().toISOString()
    };

    console.log('[Archive Expired] Process completed successfully', summary);

    return res.status(200).json({ 
      message: 'Successfully processed listings',
      summary
    });
  } catch (error: any) {
    logError('Archive expired listings', error);
    return res.status(500).json({ 
      error: 'Failed to process listings',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}