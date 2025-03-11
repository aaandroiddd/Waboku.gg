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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Fix Expired] Starting fix process', new Date().toISOString());
  
  if (req.method !== 'POST') {
    console.warn('[Fix Expired] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Log the request body to help debug
  console.log('[Fix Expired] Request body:', req.body);
  
  const { listingId } = req.body;
  
  if (!listingId) {
    console.error('[Fix Expired] Missing listing ID in request body');
    return res.status(400).json({ error: 'Listing ID is required' });
  }
  
  console.log(`[Fix Expired] Processing listing ID: ${listingId}`);

  try {
    const { db } = getFirebaseAdmin();
    
    // Get the listing document
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.log(`[Fix Expired] Listing ${listingId} not found`);
      return res.status(404).json({ error: `Listing ${listingId} not found` });
    }
    
    const data = listingDoc.data();
    if (!data) {
      console.log(`[Fix Expired] No data for listing ${listingId}`);
      return res.status(404).json({ error: `No data for listing ${listingId}` });
    }
    
    console.log(`[Fix Expired] Current listing status: ${data.status}`);
    
    const now = new Date();
    
    // Handle based on current status
    if (data.status === 'active') {
      // Check if listing has expired
      const createdAt = data.createdAt?.toDate() || new Date();
      
      // Get user data to determine account tier
      const userRef = db.collection('users').doc(data.userId);
      const userDoc = await userRef.get();
      
      const userData = userDoc.data();
      if (!userData) {
        console.log(`[Fix Expired] No user data found for listing ${listingId}, userId: ${data.userId}`);
        // Default to free tier if user data not found
        const accountTier = 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier].listingDuration;
        
        // Calculate expiration time based on tier duration
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        // Check if listing has expired
        if (now > expirationTime) {
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
          
          console.log(`[Fix Expired] Successfully archived listing ${listingId} (free tier default)`);
          
          return res.status(200).json({
            message: 'Listing archived successfully',
            status: 'archived',
            expiresAt: sevenDaysFromNow.toISOString()
          });
        }
      } else {
        const accountTier = userData.accountTier || 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        
        // Calculate expiration time based on tier duration
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        // Check if listing has expired
        if (now > expirationTime) {
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
          
          console.log(`[Fix Expired] Successfully archived listing ${listingId} (${accountTier} tier)`);
          
          return res.status(200).json({
            message: 'Listing archived successfully',
            status: 'archived',
            expiresAt: sevenDaysFromNow.toISOString()
          });
        } else {
          console.log(`[Fix Expired] Listing ${listingId} is not expired yet. Expires at: ${expirationTime.toISOString()}`);
          return res.status(200).json({
            message: 'Listing is not expired yet',
            status: 'active',
            expiresAt: expirationTime.toISOString()
          });
        }
      }
    } else if (data.status === 'archived') {
      // Check if archived listing should be deleted
      const archivedAt = data.archivedAt?.toDate() || new Date();
      const sevenDaysAfterArchive = new Date(archivedAt);
      sevenDaysAfterArchive.setDate(sevenDaysAfterArchive.getDate() + 7);
      
      if (now > sevenDaysAfterArchive) {
        // Delete the listing
        await listingRef.delete();
        
        console.log(`[Fix Expired] Successfully deleted archived listing ${listingId}`);
        
        return res.status(200).json({
          message: 'Archived listing deleted successfully',
          status: 'deleted'
        });
      } else {
        console.log(`[Fix Expired] Archived listing ${listingId} is not ready for deletion yet. Deletes at: ${sevenDaysAfterArchive.toISOString()}`);
        return res.status(200).json({
          message: 'Archived listing is not ready for deletion yet',
          status: 'archived',
          deleteAt: sevenDaysAfterArchive.toISOString()
        });
      }
    } else if (data.status === 'expired') {
      // Handle listings with 'expired' status (if any exist)
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      await listingRef.update({
        status: 'archived',
        archivedAt: Timestamp.now(),
        originalCreatedAt: data.createdAt,
        expirationReason: 'manual_fix',
        expiresAt: Timestamp.fromDate(sevenDaysFromNow),
        updatedAt: Timestamp.now()
      });
      
      console.log(`[Fix Expired] Successfully archived expired listing ${listingId}`);
      
      return res.status(200).json({
        message: 'Expired listing archived successfully',
        status: 'archived',
        expiresAt: sevenDaysFromNow.toISOString()
      });
    } else {
      // Special case: Check if the listing is actually expired but still marked as active
      // This is a fallback for listings that weren't caught by the cron job
      if (data.status === 'active') {
        const createdAt = data.createdAt?.toDate() || new Date();
        
        // Get user data to determine account tier
        let accountTier = 'free'; // Default to free tier
        try {
          const userRef = db.collection('users').doc(data.userId);
          const userDoc = await userRef.get();
          const userData = userDoc.data();
          if (userData) {
            accountTier = userData.accountTier || 'free';
          }
        } catch (error) {
          console.error(`[Fix Expired] Error getting user data for listing ${listingId}:`, error);
          // Continue with free tier as fallback
        }
        
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        // Force check if listing has expired
        if (now > expirationTime) {
          console.log(`[Fix Expired] Listing ${listingId} is expired but still active. Archiving now.`);
          
          // Archive the listing
          const sevenDaysFromNow = new Date(now);
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          
          await listingRef.update({
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt,
            expirationReason: 'manual_fix_forced',
            expiresAt: Timestamp.fromDate(sevenDaysFromNow),
            updatedAt: Timestamp.now(),
            previousStatus: data.status
          });
          
          return res.status(200).json({
            message: 'Listing was expired and has been archived successfully',
            status: 'archived',
            expiresAt: sevenDaysFromNow.toISOString()
          });
        }
      }
      
      console.log(`[Fix Expired] Listing ${listingId} has status ${data.status}, no action needed`);
      return res.status(200).json({
        message: `Listing has status '${data.status}', no action needed`,
        status: data.status
      });
    }
    
    // Default response if no conditions were met
    return res.status(200).json({
      message: 'No action taken',
      status: data.status
    });
  } catch (error: any) {
    logError('Fix expired listing', error, { listingId });
    return res.status(500).json({ 
      error: 'Failed to fix listing',
      details: error.message,
      stack: error.stack
    });
  }
}