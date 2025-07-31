import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';
import { getBatchAccountTiers } from '@/lib/account-tier-detection';
import { addTTLToListing, LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

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
  // Verify that this is a cron job request from Vercel or an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    // This is a Vercel cron job - these are automatically authorized
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Archive Expired] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // This is a manual admin request - check the token
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Archive Expired] Unauthorized access attempt', {
      hasAuth: !!authHeader,
      isVercelCron,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Log the source of the request
  console.log(`[Archive Expired] Request authorized as ${requestType}`)

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
    const now = new Date();
    
    // Get all active listings
    const activeListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    console.log(`[Archive Expired] Processing ${activeListingsSnapshot.size} active listings`);
    
    // Extract unique user IDs for batch account tier lookup
    const userIds = [...new Set(activeListingsSnapshot.docs.map(doc => doc.data()?.userId).filter(Boolean))];
    console.log(`[Archive Expired] Getting account tiers for ${userIds.length} unique users`);
    
    // Get account tiers in batch for better performance
    const accountTiers = await getBatchAccountTiers(userIds);
    
    // Process each listing with cached account tier data
    const processedListings = [];
    
    for (const doc of activeListingsSnapshot.docs) {
      try {
        const data = doc.data();
        if (!data) {
          console.warn(`[Archive Expired] Empty listing data for ${doc.id}`);
          continue;
        }

        // CRITICAL FIX: Properly parse createdAt timestamp
        let createdAt: Date;
        try {
          if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
          } else if (data.createdAt) {
            createdAt = new Date(data.createdAt);
          } else {
            console.error(`[Archive Expired] No createdAt found for listing ${doc.id}`);
            createdAt = new Date(); // Fallback to current date
          }
        } catch (timestampError) {
          console.error(`[Archive Expired] Error parsing createdAt for listing ${doc.id}:`, timestampError);
          createdAt = new Date(); // Fallback to current date
        }
        
        // Get user account tier from batch results
        const accountTierResult = accountTiers.get(data.userId);
        const accountTier = accountTierResult?.tier || 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        
        // Calculate CORRECT expiration time based on tier duration
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        // Calculate how long the listing has been active
        const hoursActive = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
        
        console.log(`[Archive Expired] Listing ${doc.id} analysis:`, {
          createdAt: createdAt.toISOString(),
          accountTier,
          tierDurationHours: tierDuration,
          hoursActive,
          expirationTime: expirationTime.toISOString(),
          isExpired: now > expirationTime,
          title: data.title?.substring(0, 50) + '...'
        });
        
        // Check if listing has expired
        if (now > expirationTime) {
          console.log(`[Archive Expired] Listing ${doc.id} has expired (${hoursActive}h active, ${tierDuration}h limit)`);
          
          // Use TTL for automatic deletion - Firestore will handle the deletion
          const ttlData = addTTLToListing({
            ...data,
            originalCreatedAt: data.createdAt,
            expirationReason: 'tier_duration_exceeded',
            // Store previous state for debugging
            previousStatus: data.status,
            previousExpiresAt: data.expiresAt,
            // Store the correct expiration calculation for debugging
            correctExpirationTime: Timestamp.fromDate(expirationTime),
            accountTierAtArchival: accountTier,
            hoursActiveAtArchival: hoursActive
          }, now);
          
          processedListings.push({
            docRef: doc.ref,
            updateData: ttlData,
            listingId: doc.id,
            userId: data.userId,
            accountTier,
            createdAt: createdAt.toISOString(),
            expirationTime: expirationTime.toISOString(),
            hoursActive,
            ttlDeleteAt: ttlData[LISTING_TTL_CONFIG.ttlField].toDate().toISOString()
          });
        } else {
          const hoursUntilExpiration = Math.round((expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60));
          console.log(`[Archive Expired] Listing ${doc.id} not expired yet (${hoursActive}h active, expires in ${hoursUntilExpiration}h)`);
        }
      } catch (error) {
        logError('Processing active listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    }
    
    console.log(`[Archive Expired] Found ${processedListings.length} expired listings to archive`);
    
    // Apply updates in batches
    for (const listing of processedListings) {
      if (!listing) continue;
      
      batch = createNewBatchIfNeeded(db, batch, batchOperations);
      batch.update(listing.docRef, listing.updateData);
      
      batchOperations++;
      totalArchived++;
      
      if (batchOperations >= BATCH_SIZE) {
        await batch.commit();
        completedBatches++;
        console.log(`[Archive Expired] Committed batch ${completedBatches} with ${batchOperations} operations`);
        batch = db.batch();
        batchOperations = 0;
      }
      
      console.log(`[Archive Expired] Marked listing ${listing.listingId} for archival`, {
        userId: listing.userId,
        accountTier: listing.accountTier,
        createdAt: listing.createdAt,
        expirationTime: listing.expirationTime
      });
    }

    // Step 2: Archive inactive listings older than 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const inactiveSnapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(sevenDaysAgo))
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
        
        // Use TTL for automatic deletion - Firestore will handle the deletion
        const ttlData = addTTLToListing({
          ...data,
          originalCreatedAt: data.createdAt,
          expirationReason: 'inactive_timeout'
        }, now);
        
        batch.update(doc.ref, ttlData);
        
        batchOperations++;
        totalArchived++;
        
        if (batchOperations >= BATCH_SIZE) {
          batch.commit();
          completedBatches++;
          console.log(`[Archive Expired] Committed batch ${completedBatches} with ${batchOperations} operations`);
          batch = db.batch();
          batchOperations = 0;
        }
        
        console.log(`[Archive Expired] Marked inactive listing ${doc.id} for archival with TTL`, {
          userId: data.userId,
          updatedAt: data.updatedAt?.toDate().toISOString(),
          ttlDeleteAt: ttlData[LISTING_TTL_CONFIG.ttlField].toDate().toISOString()
        });
      } catch (error) {
        logError('Processing inactive listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });
    
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