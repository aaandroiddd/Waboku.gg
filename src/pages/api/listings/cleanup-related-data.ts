import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

/**
 * Minimal cron job for cleaning up related data after TTL deletion
 * This runs after Firestore TTL has automatically deleted listings
 * and cleans up orphaned favorites and other related data
 */

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Cleanup Related Data] Request received', {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: {
      authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'missing',
      'user-agent': req.headers['user-agent'],
      'x-vercel-cron': req.headers['x-vercel-cron']
    },
    environment: process.env.NODE_ENV
  });

  // Verify that this is a cron job request from Vercel or an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    // This is a Vercel cron job - these are automatically authorized
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Cleanup Related Data] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // This is a manual admin request - check the token
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Cleanup Related Data] Unauthorized access attempt', {
      hasAuth: !!authHeader,
      isVercelCron,
      userAgent: req.headers['user-agent']
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cleanup Related Data] Starting related data cleanup process', {
    timestamp: new Date().toISOString(),
    requestType,
    isVercelCron
  });

  try {
    // Get Firebase admin instance
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      console.error('[Cleanup Related Data] Firestore not available on admin instance');
      return res.status(500).json({ 
        error: 'Failed to initialize Firestore',
        details: 'Firestore not available on admin instance'
      });
    }
    
    const db = admin.firestore();
    console.log('[Cleanup Related Data] Firestore initialized successfully');
    
    let totalFavoritesRemoved = 0;
    let totalOffersRemoved = 0;
    let completedBatches = 0;

    // Step 1: Find and remove orphaned favorites
    // Get all favorites and check if their referenced listings still exist
    console.log('[Cleanup Related Data] Starting orphaned favorites cleanup');
    
    const favoritesSnapshot = await db.collectionGroup('favorites').get();
    console.log(`[Cleanup Related Data] Found ${favoritesSnapshot.size} total favorites to check`);

    // Process favorites in batches to avoid memory issues
    const batchSize = 100;
    const favoritesBatches = [];
    
    for (let i = 0; i < favoritesSnapshot.docs.length; i += batchSize) {
      favoritesBatches.push(favoritesSnapshot.docs.slice(i, i + batchSize));
    }

    for (const batch of favoritesBatches) {
      const orphanedFavorites = [];
      
      // Check each favorite's listing reference
      for (const favoriteDoc of batch) {
        try {
          const favoriteData = favoriteDoc.data();
          if (!favoriteData.listingId) continue;
          
          // Check if the listing still exists
          const listingRef = db.collection('listings').doc(favoriteData.listingId);
          const listingDoc = await listingRef.get();
          
          if (!listingDoc.exists) {
            // Listing was deleted by TTL, this favorite is orphaned
            orphanedFavorites.push(favoriteDoc.ref);
            console.log(`[Cleanup Related Data] Found orphaned favorite for deleted listing ${favoriteData.listingId}`);
          }
        } catch (error) {
          console.error(`[Cleanup Related Data] Error checking favorite ${favoriteDoc.id}:`, error);
          // If we can't check, assume it's orphaned to be safe
          orphanedFavorites.push(favoriteDoc.ref);
        }
      }
      
      // Delete orphaned favorites in batches
      if (orphanedFavorites.length > 0) {
        const deleteBatch = db.batch();
        let batchOperations = 0;
        
        for (const favoriteRef of orphanedFavorites) {
          deleteBatch.delete(favoriteRef);
          batchOperations++;
          totalFavoritesRemoved++;
          
          if (batchOperations >= BATCH_SIZE) {
            await deleteBatch.commit();
            completedBatches++;
            console.log(`[Cleanup Related Data] Committed favorites cleanup batch ${completedBatches} with ${batchOperations} operations`);
            break; // Start a new batch
          }
        }
        
        // Commit remaining operations
        if (batchOperations > 0 && batchOperations < BATCH_SIZE) {
          await deleteBatch.commit();
          completedBatches++;
          console.log(`[Cleanup Related Data] Committed final favorites cleanup batch with ${batchOperations} operations`);
        }
      }
    }

    // Step 2: Clean up orphaned offers (offers for deleted listings)
    console.log('[Cleanup Related Data] Starting orphaned offers cleanup');
    
    const offersSnapshot = await db.collection('offers').get();
    console.log(`[Cleanup Related Data] Found ${offersSnapshot.size} total offers to check`);

    const orphanedOffers = [];
    
    for (const offerDoc of offersSnapshot.docs) {
      try {
        const offerData = offerDoc.data();
        if (!offerData.listingId) continue;
        
        // Check if the listing still exists
        const listingRef = db.collection('listings').doc(offerData.listingId);
        const listingDoc = await listingRef.get();
        
        if (!listingDoc.exists) {
          // Listing was deleted by TTL, this offer is orphaned
          orphanedOffers.push(offerDoc.ref);
          console.log(`[Cleanup Related Data] Found orphaned offer for deleted listing ${offerData.listingId}`);
        }
      } catch (error) {
        console.error(`[Cleanup Related Data] Error checking offer ${offerDoc.id}:`, error);
        // If we can't check, assume it's orphaned to be safe
        orphanedOffers.push(offerDoc.ref);
      }
    }
    
    // Delete orphaned offers in batches
    if (orphanedOffers.length > 0) {
      const deleteBatch = db.batch();
      let batchOperations = 0;
      
      for (const offerRef of orphanedOffers) {
        deleteBatch.delete(offerRef);
        batchOperations++;
        totalOffersRemoved++;
        
        if (batchOperations >= BATCH_SIZE) {
          await deleteBatch.commit();
          completedBatches++;
          console.log(`[Cleanup Related Data] Committed offers cleanup batch ${completedBatches} with ${batchOperations} operations`);
          break; // Would need to create new batch for remaining
        }
      }
      
      // Commit remaining operations
      if (batchOperations > 0 && batchOperations < BATCH_SIZE) {
        await deleteBatch.commit();
        completedBatches++;
        console.log(`[Cleanup Related Data] Committed final offers cleanup batch with ${batchOperations} operations`);
      }
    }

    const summary = {
      totalFavoritesRemoved,
      totalOffersRemoved,
      completedBatches,
      timestamp: new Date().toISOString(),
      note: 'Primary listing deletion handled by Firestore TTL'
    };

    console.log('[Cleanup Related Data] Process completed successfully', summary);

    return res.status(200).json({
      message: `Successfully cleaned up ${totalFavoritesRemoved} orphaned favorites and ${totalOffersRemoved} orphaned offers`,
      summary
    });
  } catch (error: any) {
    console.error('[Cleanup Related Data] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    logError('Cleanup related data', error);
    return res.status(500).json({
      error: 'Failed to clean up related data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}