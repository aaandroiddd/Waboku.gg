import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';

// Maximum number of operations in a single batch
const BATCH_SIZE = 500;

// Helper function to create a new batch when the current one is full
const createNewBatchIfNeeded = (db: FirebaseFirestore.Firestore, currentBatch: FirebaseFirestore.WriteBatch, operationCount: number) => {
  if (operationCount >= BATCH_SIZE) {
    return db.batch();
  }
  return currentBatch;
};

// Helper function to log errors with context
const logError = (context: string, error: any, additionalInfo?: any) => {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo
  });
};

// Helper function to process documents in batches
async function processBatch(docs: FirebaseFirestore.QueryDocumentSnapshot[], processor: (doc: FirebaseFirestore.QueryDocumentSnapshot, batch: FirebaseFirestore.WriteBatch) => Promise<void>, db: FirebaseFirestore.Firestore) {
  const batchSize = 50; // Reduced batch size for better reliability
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + batchSize);
    
    try {
      // Process each document individually to prevent one failure from stopping the entire batch
      for (const doc of chunk) {
        try {
          await processor(doc, batch);
        } catch (docError) {
          errors++;
          logError(`Processing document ${doc.id}`, docError, {
            docData: doc.data ? doc.data() : 'No data available'
          });
          // Continue with next document
        }
      }
      
      // Only commit if we have operations
      if (batch._ops && batch._ops.length > 0) {
        try {
          await batch.commit();
          processed += batch._ops.length;
          console.log(`[Cleanup Inactive Listings] Committed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(docs.length/batchSize)}: ${batch._ops.length} operations. Total processed: ${processed}`);
        } catch (commitError) {
          logError('Committing batch', commitError, {
            batchIndex: i,
            operationsCount: batch._ops.length
          });
          // Continue with next batch
        }
      } else {
        console.log(`[Cleanup Inactive Listings] Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(docs.length/batchSize)} had no operations to commit`);
      }
    } catch (batchError) {
      errors++;
      logError('Processing batch', batchError, { 
        batchIndex: i, 
        batchSize: chunk.length,
        firstDocId: chunk[0]?.id 
      });
      // Continue with next batch
    }
  }
  
  console.log(`[Cleanup Inactive Listings] Batch processing complete: ${processed} operations processed, ${errors} errors encountered`);
  return processed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Force console log to ensure visibility in Vercel logs
  console.log('[Cleanup Inactive Listings] Starting cleanup process', new Date().toISOString());
  
  if (req.method !== 'POST') {
    console.warn('[Cleanup Inactive Listings] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listingId } = req.body; // Optional: specific listing ID to process

  try {
    console.log('[Cleanup Inactive Listings] Initializing Firebase Admin');
    const { db } = getFirebaseAdmin();
    let totalArchived = 0;
    let totalDeleted = 0;
    
    // Step 1: Archive expired active listings
    console.log('[Cleanup Inactive Listings] Fetching active listings...');
    let activeListingsQuery = db.collection('listings')
      .where('status', '==', 'active');

    // If specific listing ID provided, only process that one
    if (listingId) {
      console.log(`[Cleanup Inactive Listings] Processing specific listing: ${listingId}`);
      activeListingsQuery = db.collection('listings').doc(listingId);
      const docSnapshot = await activeListingsQuery.get();
      
      if (!docSnapshot.exists) {
        console.log(`[Cleanup Inactive Listings] Listing ${listingId} not found`);
        return res.status(404).json({ error: `Listing ${listingId} not found` });
      }
      
      // Process this single listing
      const batch = db.batch();
      const data = docSnapshot.data();
      
      if (!data) {
        console.log(`[Cleanup Inactive Listings] No data for listing ${listingId}`);
        return res.status(404).json({ error: `No data for listing ${listingId}` });
      }
      
      if (data.status === 'active') {
        const createdAt = data.createdAt?.toDate() || new Date();
        let accountTier = 'free';
        let tierDuration = ACCOUNT_TIERS.free.listingDuration;
        
        try {
          // Try to get user data, but don't fail if not found
          const userRef = db.collection('users').doc(data.userId);
          const userDoc = await userRef.get();
          const userData = userDoc.data();
          
          if (userData) {
            accountTier = userData.accountTier || 'free';
            tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
          } else {
            console.log(`[Cleanup Inactive Listings] No user data found for listing ${listingId}, using free tier defaults`);
          }
        } catch (userError) {
          console.error(`[Cleanup Inactive Listings] Error fetching user data for listing ${listingId}:`, userError);
          // Continue with free tier defaults
        }
        
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        if (new Date() > expirationTime) {
          console.log(`[Cleanup Inactive Listings] Archiving expired listing ${listingId} (created: ${createdAt.toISOString()}, tier: ${accountTier})`);
          batch.update(docSnapshot.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            updatedAt: Timestamp.now(),
            expirationReason: 'tier_duration_exceeded'
          });
          
          await batch.commit();
          totalArchived++;
          
          console.log(`[Cleanup Inactive Listings] Successfully archived listing ${listingId}`);
        } else {
          console.log(`[Cleanup Inactive Listings] Listing ${listingId} is not expired yet. Expires at: ${expirationTime.toISOString()}`);
        }
      } else if (data.status === 'expired') {
        // If it's already marked as expired, move it to archived
        console.log(`[Cleanup Inactive Listings] Moving expired listing ${listingId} to archived status`);
        batch.update(docSnapshot.ref, {
          status: 'archived',
          archivedAt: Timestamp.now(),
          originalCreatedAt: data.createdAt,
          updatedAt: Timestamp.now(),
          expirationReason: 'manual_archive'
        });
        
        await batch.commit();
        totalArchived++;
        
        console.log(`[Cleanup Inactive Listings] Successfully archived expired listing ${listingId}`);
      } else {
        console.log(`[Cleanup Inactive Listings] Listing ${listingId} has status ${data.status}, not processing`);
      }
      
      return res.status(200).json({
        message: `Processed listing ${listingId}`,
        details: {
          archived: totalArchived,
          deleted: totalDeleted,
          status: data.status
        }
      });
    }

    // Process all active listings
    const activeListingsSnapshot = await activeListingsQuery.get();
    console.log(`[Cleanup Inactive Listings] Found ${activeListingsSnapshot.size} active listings to process`);
    
    const processActiveListing = async (doc: FirebaseFirestore.QueryDocumentSnapshot, batch: FirebaseFirestore.WriteBatch) => {
      try {
        const data = doc.data();
        if (!data) {
          console.log(`[Cleanup Inactive Listings] No data for listing ${doc.id}`);
          return;
        }

        const createdAt = data.createdAt?.toDate() || new Date();
        let accountTier = 'free';
        let tierDuration = ACCOUNT_TIERS.free.listingDuration;
        
        try {
          const userRef = db.collection('users').doc(data.userId);
          const userDoc = await userRef.get();
          const userData = userDoc.data();
          
          if (userData) {
            accountTier = userData.accountTier || 'free';
            tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
          } else {
            console.log(`[Cleanup Inactive Listings] No user data found for listing ${doc.id}, using free tier defaults`);
          }
        } catch (userError) {
          console.error(`[Cleanup Inactive Listings] Error fetching user data for listing ${doc.id}:`, userError);
          // Continue with free tier defaults
        }
        
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        if (new Date() > expirationTime) {
          console.log(`[Cleanup Inactive Listings] Archiving expired listing ${doc.id} (created: ${createdAt.toISOString()}, tier: ${accountTier})`);
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            updatedAt: Timestamp.now(),
            expirationReason: 'tier_duration_exceeded'
          });
          totalArchived++;
        }
      } catch (error) {
        logError('Processing active listing', error, {
          listingId: doc.id,
          data: doc.data ? doc.data() : 'No data available'
        });
        // Don't throw the error, just log it and continue with other listings
      }
    };

    if (activeListingsSnapshot.size > 0) {
      try {
        await processBatch(activeListingsSnapshot.docs, processActiveListing, db);
      } catch (batchError) {
        console.error('[Cleanup Inactive Listings] Error processing active listings batch:', batchError);
        // Continue with other steps
      }
    }

    // Step 2: Archive inactive listings older than 7 days
    console.log('[Cleanup Inactive Listings] Processing inactive listings...');
    try {
      const inactiveSnapshot = await db.collection('listings')
        .where('status', '==', 'inactive')
        .where('updatedAt', '<', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .get();

      console.log(`[Cleanup Inactive Listings] Found ${inactiveSnapshot.size} inactive listings to archive`);

      const processInactiveListing = async (doc: FirebaseFirestore.QueryDocumentSnapshot, batch: FirebaseFirestore.WriteBatch) => {
        try {
          const data = doc.data();
          if (!data) return;

          console.log(`[Cleanup Inactive Listings] Archiving inactive listing ${doc.id}`);
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            updatedAt: Timestamp.now(),
            expirationReason: 'inactive_timeout'
          });
          totalArchived++;
        } catch (error) {
          logError('Processing inactive listing', error, {
            listingId: doc.id,
            data: doc.data ? doc.data() : 'No data available'
          });
          // Don't throw the error, just log it and continue with other listings
        }
      };

      if (inactiveSnapshot.size > 0) {
        try {
          await processBatch(inactiveSnapshot.docs, processInactiveListing, db);
        } catch (batchError) {
          console.error('[Cleanup Inactive Listings] Error processing inactive listings batch:', batchError);
          // Continue with other steps
        }
      }
    } catch (inactiveError) {
      console.error('[Cleanup Inactive Listings] Error fetching inactive listings:', inactiveError);
      // Continue with other steps
    }

    // Step 3: Process expired listings (if they exist)
    console.log('[Cleanup Inactive Listings] Processing expired listings...');
    try {
      const expiredSnapshot = await db.collection('listings')
        .where('status', '==', 'expired')
        .get();

      console.log(`[Cleanup Inactive Listings] Found ${expiredSnapshot.size} expired listings to archive`);

      const processExpiredListing = async (doc: FirebaseFirestore.QueryDocumentSnapshot, batch: FirebaseFirestore.WriteBatch) => {
        try {
          const data = doc.data();
          if (!data) return;

          console.log(`[Cleanup Inactive Listings] Moving expired listing ${doc.id} to archived status`);
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            updatedAt: Timestamp.now(),
            expirationReason: 'manual_archive'
          });
          totalArchived++;
        } catch (error) {
          logError('Processing expired listing', error, {
            listingId: doc.id,
            data: doc.data ? doc.data() : 'No data available'
          });
          // Don't throw the error, just log it and continue with other listings
        }
      };

      if (expiredSnapshot.size > 0) {
        try {
          await processBatch(expiredSnapshot.docs, processExpiredListing, db);
        } catch (batchError) {
          console.error('[Cleanup Inactive Listings] Error processing expired listings batch:', batchError);
          // Continue with other steps
        }
      }
    } catch (expiredError) {
      console.error('[Cleanup Inactive Listings] Error fetching expired listings:', expiredError);
      // Continue with other steps
    }

    // Step 4: Delete archived listings that have exceeded their 7-day retention period
    console.log('[Cleanup Inactive Listings] Processing archived listings for deletion...');
    try {
      // Only get archived listings that are older than 7 days based on their archivedAt timestamp
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const expiredArchivedSnapshot = await db.collection('listings')
        .where('status', '==', 'archived')
        .where('archivedAt', '<', Timestamp.fromDate(sevenDaysAgo))
        .get();
      
      console.log(`[Cleanup Inactive Listings] Found ${expiredArchivedSnapshot.size} expired archived listings for deletion`);

      const processArchivedListing = async (doc: FirebaseFirestore.QueryDocumentSnapshot, batch: FirebaseFirestore.WriteBatch) => {
        try {
          const data = doc.data();
          const archivedAt = data.archivedAt?.toDate();
          
          // Double-check the archive date to ensure we're only deleting listings that are truly expired
          if (archivedAt && archivedAt < sevenDaysAgo) {
            console.log(`[Cleanup Inactive Listings] Deleting expired archived listing ${doc.id} (archived: ${archivedAt.toISOString()})`);
            batch.delete(doc.ref);
            totalDeleted++;
          } else {
            console.log(`[Cleanup Inactive Listings] Skipping non-expired archived listing ${doc.id}`);
          }
        } catch (error) {
          logError('Processing archived listing', error, {
            listingId: doc.id,
            data: doc.data ? doc.data() : 'No data available'
          });
          // Don't throw the error, just log it and continue with other listings
        }
      };

      if (expiredArchivedSnapshot.size > 0) {
        try {
          await processBatch(expiredArchivedSnapshot.docs, processArchivedListing, db);
        } catch (batchError) {
          console.error('[Cleanup Inactive Listings] Error processing archived listings batch:', batchError);
        }
      }
    } catch (archivedError) {
      console.error('[Cleanup Inactive Listings] Error fetching archived listings:', archivedError);
    }
    
    const summary = `Successfully processed listings: ${totalArchived} archived, ${totalDeleted} deleted`;
    console.log(`[Cleanup Inactive Listings] ${summary}`);

    return res.status(200).json({ 
      message: summary,
      details: {
        archived: totalArchived,
        deleted: totalDeleted
      }
    });
  } catch (error: any) {
    logError('Cleanup inactive listings', error);
    return res.status(500).json({ 
      error: 'Failed to process listings',
      details: error.message,
      stack: error.stack
    });
  }
}