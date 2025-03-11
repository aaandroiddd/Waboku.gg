import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';

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
 * Middleware to handle listing expiration in the background
 * This will be called by the API route to check and archive expired listings
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
          // Try to convert the expiresAt field to a Date
          expirationTime = data.expiresAt?.toDate ? data.expiresAt.toDate() : 
                          data.expiresAt instanceof Date ? data.expiresAt : 
                          new Date(data.expiresAt);
          
          console.log(`[ListingExpiration] Listing ${listingId} has explicit expiresAt: ${expirationTime.toISOString()}`);
        } catch (expiresAtError) {
          console.error(`[ListingExpiration] Error converting expiresAt timestamp for listing ${listingId}:`, expiresAtError);
          
          // Fall back to calculating from createdAt
          let createdAt: Date;
          try {
            createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                      data.createdAt instanceof Date ? data.createdAt : 
                      new Date(data.createdAt || Date.now());
          } catch (timestampError) {
            console.error(`[ListingExpiration] Error converting createdAt timestamp for listing ${listingId}:`, timestampError);
            createdAt = new Date(); // Fallback to current date
          }
          
          // Get user data to determine account tier with error handling
          let accountTier = 'free'; // Default to free tier
          let tierDuration = ACCOUNT_TIERS.free.listingDuration;
          
          try {
            if (data.userId) {
              const userRef = db.collection('users').doc(data.userId);
              const userDoc = await userRef.get();
              
              if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData) {
                  accountTier = userData.accountTier || 'free';
                  tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
                }
              }
            }
          } catch (userError) {
            console.error(`[ListingExpiration] Error fetching user data for listing ${listingId}:`, userError);
            // Continue with default free tier values
          }
          
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
        
        // Get user data to determine account tier with error handling
        let accountTier = 'free'; // Default to free tier
        let tierDuration = ACCOUNT_TIERS.free.listingDuration;
        
        try {
          if (data.userId) {
            const userRef = db.collection('users').doc(data.userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData) {
                accountTier = userData.accountTier || 'free';
                tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
              }
            }
          }
        } catch (userError) {
          console.error(`[ListingExpiration] Error fetching user data for listing ${listingId}:`, userError);
          // Continue with default free tier values
        }
        
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