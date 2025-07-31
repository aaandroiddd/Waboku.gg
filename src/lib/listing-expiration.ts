import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';
import { getUserAccountTier } from '@/lib/account-tier-detection';

// Add more detailed logging for debugging
const logError = (message: string, error: any) => {
  console.error(`[ListingExpiration] ${message}:`, {
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    code: error.code,
    name: error.name
  });
};

/**
 * Enhanced middleware to handle listing expiration with improved account tier detection
 */
export async function checkAndArchiveExpiredListing(listingId: string) {
  try {
    console.log(`[ListingExpiration] Checking listing ${listingId} for expiration`);
    
    // Validate listing ID
    if (!listingId || typeof listingId !== 'string') {
      console.error('[ListingExpiration] Invalid listing ID:', listingId);
      return { 
        success: false, 
        error: 'Invalid listing ID provided' 
      };
    }
    
    // Get Firebase admin with better error handling
    const firebaseAdmin = getFirebaseAdmin();
    
    if (!firebaseAdmin || !firebaseAdmin.db) {
      console.error('[ListingExpiration] Firebase admin or Firestore DB is not initialized properly');
      return { 
        success: false, 
        error: 'Database connection error - admin not initialized properly' 
      };
    }
    
    const { db } = firebaseAdmin;
    
    // Get the listing document with error handling
    try {
      // Get the listing document with better error handling
      const listingRef = db.collection('listings').doc(listingId);
      
      let listingDoc;
      try {
        listingDoc = await listingRef.get();
      } catch (fetchError: any) {
        console.error(`[ListingExpiration] Error fetching listing ${listingId}:`, {
          message: fetchError.message,
          code: fetchError.code,
          name: fetchError.name,
          stack: fetchError.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        // Check for specific error related to certificate/private key issues
        if (fetchError.message?.includes('DECODER routines') || 
            fetchError.message?.includes('unsupported') ||
            fetchError.code === 'UNKNOWN') {
          return { 
            success: false, 
            error: `Firebase credential error: ${fetchError.message}. Please check the private key format.`
          };
        }
        
        return { 
          success: false, 
          error: `Failed to retrieve listing: ${fetchError.code || 'unknown'} ${fetchError.message || 'Unknown error'}`
        };
      }
      
      if (!listingDoc.exists) {
        console.log(`[ListingExpiration] Listing ${listingId} not found`);
        return { success: false, error: 'Listing not found' };
      }
      
      const data = listingDoc.data();
      if (!data) {
        console.log(`[ListingExpiration] No data for listing ${listingId}`);
        return { success: false, error: 'No data for listing' };
      }
      
      // If already archived, no need to check
      if (data.status === 'archived') {
        return { success: true, status: 'already_archived' };
      }
      
      const now = new Date();
      
      // CRITICAL FIX: Always calculate expiration from createdAt and account tier
      // Don't rely on potentially incorrect expiresAt field
      let createdAt: Date;
      try {
        // Parse createdAt timestamp properly
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
          createdAt = data.createdAt;
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt);
        } else {
          console.error(`[ListingExpiration] No createdAt found for listing ${listingId}`);
          createdAt = new Date(); // Fallback to current date
        }
      } catch (timestampError) {
        console.error(`[ListingExpiration] Error converting createdAt timestamp for listing ${listingId}:`, timestampError);
        createdAt = new Date(); // Fallback to current date
      }
      
      // Get user account tier with simplified centralized function
      const accountTierResult = await getUserAccountTier(data.userId);
      const accountTier = accountTierResult.tier;
      const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
      
      // Calculate CORRECT expiration time based on tier duration
      const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
      
      console.log(`[ListingExpiration] Listing ${listingId} details:`, {
        createdAt: createdAt.toISOString(),
        accountTier,
        tierDurationHours: tierDuration,
        calculatedExpiration: expirationTime.toISOString(),
        currentTime: now.toISOString(),
        isExpired: now > expirationTime,
        hoursActive: Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60))
      });
      
      // Check if listing has expired
      if (now > expirationTime) {
        console.log(`[ListingExpiration] Listing ${listingId} has expired. Archiving...`);
        
        // Archive the listing with TTL for automatic deletion after 7 days
        const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        try {
          await listingRef.update({
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            expirationReason: 'tier_duration_exceeded',
            // Set TTL for automatic deletion after 7 days
            deleteAt: Timestamp.fromDate(sevenDaysFromNow),
            ttlSetAt: Timestamp.now(),
            ttlReason: 'automated_archive',
            updatedAt: Timestamp.now(),
            // Store previous state for debugging
            previousStatus: data.status,
            previousExpiresAt: data.expiresAt,
            // Store the correct expiration calculation for debugging
            correctExpirationTime: Timestamp.fromDate(expirationTime),
            accountTierAtArchival: accountTier
          });
          
          console.log(`[ListingExpiration] Successfully archived listing ${listingId} with TTL deletion at ${sevenDaysFromNow.toISOString()}`);
          
          return { 
            success: true, 
            status: 'archived',
            message: 'Listing has been archived due to expiration',
            details: {
              createdAt: createdAt.toISOString(),
              expirationTime: expirationTime.toISOString(),
              accountTier,
              tierDurationHours: tierDuration,
              ttlDeleteAt: sevenDaysFromNow.toISOString()
            }
          };
        } catch (updateError: any) {
          console.error(`[ListingExpiration] Error updating listing ${listingId}:`, updateError);
          return { 
            success: false, 
            error: `Failed to archive listing: ${updateError.message || 'Unknown error'}`
          };
        }
      } else {
        const hoursUntilExpiration = Math.round((expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        console.log(`[ListingExpiration] Listing ${listingId} is not expired yet. Expires in ${hoursUntilExpiration} hours at: ${expirationTime.toISOString()}`);
        return { 
          success: true, 
          status: 'active',
          expiresAt: expirationTime.toISOString(),
          hoursUntilExpiration
        };
      }
    } catch (docError: any) {
      console.error(`[ListingExpiration] Error retrieving listing ${listingId}:`, docError);
      return { 
        success: false, 
        error: `Failed to retrieve listing: ${docError.message || 'Unknown error'}`
      };
    }
  } catch (error: any) {
    // Log detailed error information
    logError(`Error checking listing ${listingId}`, error);
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred during expiration check'
    };
  }
}

/**
 * Function to restore incorrectly archived listings for premium users
 */
export async function restoreIncorrectlyArchivedListings(userId: string) {
  try {
    console.log(`[ListingExpiration] Checking for incorrectly archived listings for user ${userId}`);
    
    // Get Firebase admin
    const { db } = getFirebaseAdmin();
    
    // First, determine if the user is premium using centralized function
    const accountTierResult = await getUserAccountTier(userId);
    const accountTier = accountTierResult.tier;
    
    if (accountTier !== 'premium') {
      console.log(`[ListingExpiration] User ${userId} is not premium, no restoration needed`);
      return {
        success: true,
        status: 'skipped',
        message: 'User is not premium, no restoration needed'
      };
    }
    
    // Get all archived listings for this user that were archived due to expiration
    const archivedListingsSnapshot = await db.collection('listings')
      .where('userId', '==', userId)
      .where('status', '==', 'archived')
      .where('expirationReason', '==', 'tier_duration_exceeded')
      .get();
    
    if (archivedListingsSnapshot.empty) {
      console.log(`[ListingExpiration] No incorrectly archived listings found for user ${userId}`);
      return {
        success: true,
        status: 'no_listings',
        message: 'No incorrectly archived listings found'
      };
    }
    
    console.log(`[ListingExpiration] Found ${archivedListingsSnapshot.size} potentially incorrectly archived listings for user ${userId}`);
    
    // Get the premium tier duration
    const premiumDuration = ACCOUNT_TIERS.premium.listingDuration;
    const now = new Date();
    let restoredCount = 0;
    
    // Process each archived listing
    for (const doc of archivedListingsSnapshot.docs) {
      try {
        const data = doc.data();
        
        // Skip if no data
        if (!data) {
          console.log(`[ListingExpiration] No data for listing ${doc.id}`);
          continue;
        }
        
        // Get the original creation date
        const createdAt = data.originalCreatedAt?.toDate() || data.createdAt?.toDate() || new Date();
        
        // Calculate when it should expire based on premium tier
        const shouldExpireAt = new Date(createdAt.getTime() + (premiumDuration * 60 * 60 * 1000));
        
        // If the listing shouldn't have expired yet, restore it
        if (now < shouldExpireAt) {
          console.log(`[ListingExpiration] Restoring incorrectly archived listing ${doc.id}`);
          
          // Restore to active status
          await doc.ref.update({
            status: data.previousStatus || 'active',
            expiresAt: Timestamp.fromDate(shouldExpireAt),
            updatedAt: Timestamp.now(),
            restoredAt: Timestamp.now(),
            restoredReason: 'premium_user_correction',
            archivedAt: null,
            expirationReason: null,
            // CRITICAL: Remove TTL field to prevent automatic deletion
            // When a listing is restored to active, it should not be automatically deleted
            deleteAt: null,
            ttlSetAt: null,
            ttlReason: null
          });
          
          restoredCount++;
        } else {
          console.log(`[ListingExpiration] Listing ${doc.id} would still be expired even with premium tier, not restoring`);
        }
      } catch (error) {
        console.error(`[ListingExpiration] Error processing archived listing ${doc.id}:`, error);
      }
    }
    
    console.log(`[ListingExpiration] Restored ${restoredCount} listings for user ${userId}`);
    
    return {
      success: true,
      status: 'restored',
      restoredCount,
      totalFound: archivedListingsSnapshot.size,
      message: `Restored ${restoredCount} incorrectly archived listings`
    };
  } catch (error: any) {
    console.error(`[ListingExpiration] Error restoring archived listings for user ${userId}:`, error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to restore archived listings'
    };
  }
}