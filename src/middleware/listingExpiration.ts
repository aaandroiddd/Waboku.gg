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
    
    // Get the listing document
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
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
    
    // Check if listing has expired
    const createdAt = data.createdAt?.toDate() || new Date();
    
    // Get user data to determine account tier
    const userRef = db.collection('users').doc(data.userId);
    const userDoc = await userRef.get();
    
    const userData = userDoc.data();
    const accountTier = userData?.accountTier || 'free';
    const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
    
    // Calculate expiration time based on tier duration
    const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
    
    // Check if listing has expired
    if (now > expirationTime) {
      console.log(`[ListingExpiration] Listing ${listingId} has expired. Archiving...`);
      
      // Archive the listing
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
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
    } else {
      console.log(`[ListingExpiration] Listing ${listingId} is not expired yet. Expires at: ${expirationTime.toISOString()}`);
      return { 
        success: true, 
        status: 'active',
        expiresAt: expirationTime.toISOString()
      };
    }
  } catch (error: any) {
    console.error(`[ListingExpiration] Error checking listing ${listingId}:`, error);
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred'
    };
  }
}