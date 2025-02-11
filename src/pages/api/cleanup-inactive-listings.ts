import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';

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
  const batchSize = 100; // Reduced batch size for better reliability
  let processed = 0;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + batchSize);
    
    try {
      await Promise.all(chunk.map(doc => processor(doc, batch)));
      
      if (batch._ops.length > 0) {
        await batch.commit();
        processed += chunk.length;
        console.log(`[Cleanup Inactive Listings] Processed batch of ${chunk.length} documents. Total processed: ${processed}`);
      }
    } catch (error) {
      logError('Processing batch', error, { 
        batchIndex: i, 
        batchSize: chunk.length,
        firstDocId: chunk[0]?.id 
      });
      throw error; // Re-throw to handle in the main try-catch
    }
  }
  
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
      activeListingsQuery = activeListingsQuery.where('__name__', '==', listingId);
    }

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
        const userRef = db.collection('users').doc(data.userId);
        const userDoc = await userRef.get();
        
        const userData = userDoc.data();
        if (!userData) {
          console.log(`[Cleanup Inactive Listings] No user data found for listing ${doc.id}, using free tier defaults`);
          // Default to free tier if no user data found
          const tierDuration = ACCOUNT_TIERS.free.listingDuration;
          const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
          
          if (new Date() > expirationTime) {
            batch.update(doc.ref, {
              status: 'archived',
              archivedAt: Timestamp.now(),
              originalCreatedAt: data.createdAt,
              updatedAt: Timestamp.now()
            });
            totalArchived++;
          }
          return;
        }
        
        const accountTier = userData.accountTier || 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        if (new Date() > expirationTime) {
          console.log(`[Cleanup Inactive Listings] Archiving expired listing ${doc.id} (created: ${createdAt.toISOString()}, tier: ${accountTier})`);
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            updatedAt: Timestamp.now()
          });
          totalArchived++;
        }
      } catch (error) {
        logError('Processing active listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
        throw error;
      }
    };

    if (activeListingsSnapshot.size > 0) {
      await processBatch(activeListingsSnapshot.docs, processActiveListing, db);
    }

    // Step 2: Archive inactive listings older than 7 days
    if (!listingId) {
      console.log('[Cleanup Inactive Listings] Processing inactive listings...');
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
            updatedAt: Timestamp.now()
          });
          totalArchived++;
        } catch (error) {
          logError('Processing inactive listing', error, {
            listingId: doc.id,
            data: doc.data()
          });
          throw error;
        }
      };

      if (inactiveSnapshot.size > 0) {
        await processBatch(inactiveSnapshot.docs, processInactiveListing, db);
      }

      // Step 3: Delete archived listings that have exceeded their 7-day retention period
      console.log('[Cleanup Inactive Listings] Processing archived listings...');
      
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
            data: doc.data()
          });
          throw error;
        }
      };

      if (expiredArchivedSnapshot.size > 0) {
        await processBatch(expiredArchivedSnapshot.docs, processArchivedListing, db);
      }
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
      details: error.message
    });
  }
}