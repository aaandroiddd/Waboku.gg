import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';
import { parseDate } from '@/lib/date-utils';
import { getSubscriptionData } from '@/lib/subscription-sync';

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
 * Enhanced function to determine a user's account tier by checking both
 * the accountTier field and active subscription data
 */
export async function determineUserAccountTier(userId: string) {
  try {
    console.log(`[ListingExpiration] Determining account tier for user ${userId}`);
    
    const { db } = getFirebaseAdmin();
    
    // Get user document from Firestore
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`[ListingExpiration] No user document found for ${userId}, defaulting to free tier`);
      return 'free';
    }
    
    const userData = userDoc.data();
    if (!userData) {
      console.log(`[ListingExpiration] Empty user data for ${userId}, defaulting to free tier`);
      return 'free';
    }
    
    // First check: accountTier field
    const accountTierFromField = userData.accountTier || 'free';
    
    // Second check: subscription data
    let accountTierFromSubscription = 'free';
    
    // Check if there's subscription data in the user document
    if (userData.subscription) {
      const now = new Date();
      const subscription = userData.subscription;
      
      // Check if subscription is active or within paid period
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        accountTierFromSubscription = 'premium';
      } else if (subscription.status === 'canceled' && subscription.endDate) {
        // For canceled subscriptions, check if still within paid period
        try {
          const endDate = new Date(subscription.endDate);
          if (now < endDate) {
            accountTierFromSubscription = 'premium';
          }
        } catch (error) {
          console.error(`[ListingExpiration] Error parsing subscription end date for user ${userId}:`, error);
        }
      }
      
      // Check for admin subscriptions
      if (subscription.stripeSubscriptionId && 
          subscription.stripeSubscriptionId.startsWith('admin_') &&
          subscription.status !== 'none') {
        accountTierFromSubscription = 'premium';
      }
    }
    
    // Third check: Get subscription data from sync function for most accurate data
    const subscriptionData = await getSubscriptionData(userId);
    const accountTierFromSync = subscriptionData.data.accountTier || 'free';
    
    // Log all sources for debugging
    console.log(`[ListingExpiration] Account tier sources for user ${userId}:`, {
      fromField: accountTierFromField,
      fromSubscription: accountTierFromSubscription,
      fromSync: accountTierFromSync
    });
    
    // Use the highest tier from all sources (premium > free)
    if (accountTierFromField === 'premium' || 
        accountTierFromSubscription === 'premium' || 
        accountTierFromSync === 'premium') {
      console.log(`[ListingExpiration] Determined premium tier for user ${userId}`);
      return 'premium';
    }
    
    console.log(`[ListingExpiration] Determined free tier for user ${userId}`);
    return 'free';
  } catch (error) {
    console.error(`[ListingExpiration] Error determining account tier for user ${userId}:`, error);
    return 'free'; // Default to free tier on error
  }
}

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
      
      // Check if listing has explicit expiresAt field
      let expirationTime: Date;
      
      if (data.expiresAt) {
        try {
          // Use our utility function to safely parse the date
          expirationTime = parseDate(data.expiresAt);
          
          console.log(`[ListingExpiration] Listing ${listingId} has explicit expiresAt: ${expirationTime.toISOString()}`);
        } catch (expiresAtError) {
          console.error(`[ListingExpiration] Error converting expiresAt timestamp for listing ${listingId}:`, expiresAtError);
          
          // Fall back to calculating from createdAt
          let createdAt: Date;
          try {
            // Use our utility function to safely parse the date
            createdAt = parseDate(data.createdAt, new Date());
          } catch (timestampError) {
            console.error(`[ListingExpiration] Error converting createdAt timestamp for listing ${listingId}:`, timestampError);
            createdAt = new Date(); // Fallback to current date
          }
          
          // Get user account tier with enhanced function
          const accountTier = await determineUserAccountTier(data.userId);
          const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
          
          // Calculate expiration time based on tier duration
          expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        }
      } else {
        // No expiresAt field, calculate from createdAt
        let createdAt: Date;
        try {
          createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                    data.createdAt instanceof Date ? data.createdAt : 
                    new Date(data.createdAt || Date.now());
        } catch (timestampError) {
          console.error(`[ListingExpiration] Error converting createdAt timestamp for listing ${listingId}:`, timestampError);
          createdAt = new Date(); // Fallback to current date
        }
        
        // Get user account tier with enhanced function
        const accountTier = await determineUserAccountTier(data.userId);
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        
        // Calculate expiration time based on tier duration
        expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
      }
      
      console.log(`[ListingExpiration] Listing ${listingId} expiration time: ${expirationTime.toISOString()}, current time: ${now.toISOString()}`);
      
      // Check if listing has expired
      if (now > expirationTime) {
        console.log(`[ListingExpiration] Listing ${listingId} has expired. Archiving...`);
        
        // Archive the listing
        const sevenDaysFromNow = new Date(now);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        try {
          await listingRef.update({
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            expirationReason: 'tier_duration_exceeded',
            expiresAt: Timestamp.fromDate(sevenDaysFromNow),
            updatedAt: Timestamp.now(),
            // Store previous state
            previousStatus: data.status,
            previousExpiresAt: data.expiresAt
          });
          
          console.log(`[ListingExpiration] Successfully archived listing ${listingId}`);
          
          return { 
            success: true, 
            status: 'archived',
            message: 'Listing has been archived due to expiration'
          };
        } catch (updateError: any) {
          console.error(`[ListingExpiration] Error updating listing ${listingId}:`, updateError);
          return { 
            success: false, 
            error: `Failed to archive listing: ${updateError.message || 'Unknown error'}`
          };
        }
      } else {
        console.log(`[ListingExpiration] Listing ${listingId} is not expired yet. Expires at: ${expirationTime.toISOString()}`);
        return { 
          success: true, 
          status: 'active',
          expiresAt: expirationTime.toISOString()
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
    
    // First, determine if the user is premium
    const accountTier = await determineUserAccountTier(userId);
    
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
            expirationReason: null
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