import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Fix Specific] Starting fix process for specific listing');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get listing ID from request body
  const { listingId, action = 'reactivate' } = req.body;
  
  if (!listingId) {
    return res.status(400).json({ error: 'Listing ID is required' });
  }
  
  console.log(`[Fix Specific] Processing listing ${listingId} with action: ${action}`);
  
  try {
    const { db } = getFirebaseAdmin();
    
    // Get the listing document
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.log(`[Fix Specific] Listing ${listingId} not found`);
      return res.status(404).json({ error: `Listing ${listingId} not found` });
    }
    
    const data = listingDoc.data();
    if (!data) {
      console.log(`[Fix Specific] No data for listing ${listingId}`);
      return res.status(404).json({ error: `No data for listing ${listingId}` });
    }
    
    console.log(`[Fix Specific] Current listing status: ${data.status}`);
    
    const now = new Date();
    
    if (action === 'archive') {
      // Archive the listing
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      await listingRef.update({
        status: 'archived',
        archivedAt: Timestamp.now(),
        originalCreatedAt: data.createdAt,
        expirationReason: 'manual_fix_specific',
        expiresAt: Timestamp.fromDate(sevenDaysFromNow),
        updatedAt: Timestamp.now(),
        previousStatus: data.status
      });
      
      console.log(`[Fix Specific] Successfully archived listing ${listingId}`);
      
      return res.status(200).json({
        message: 'Listing archived successfully',
        status: 'archived',
        expiresAt: sevenDaysFromNow.toISOString()
      });
    } else if (action === 'reactivate') {
      // Reactivate the listing with a new expiration date
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      await listingRef.update({
        status: 'active',
        expiresAt: Timestamp.fromDate(thirtyDaysFromNow),
        updatedAt: Timestamp.now(),
        // Clear any archive-related fields
        archivedAt: null,
        expirationReason: null,
        accountTier: 'premium' // Ensure premium tier for 30-day expiration
      });
      
      console.log(`[Fix Specific] Successfully reactivated listing ${listingId}`);
      
      return res.status(200).json({
        message: 'Listing reactivated successfully',
        status: 'active',
        expiresAt: thirtyDaysFromNow.toISOString()
      });
    } else if (action === 'refresh') {
      // Refresh the listing by updating the timestamp without changing other properties
      // This helps with listings that are technically valid but not showing up due to caching issues
      await listingRef.update({
        updatedAt: Timestamp.now(),
        // Add a small random value to force a change in the document
        _refreshToken: Math.random().toString(36).substring(2, 15)
      });
      
      console.log(`[Fix Specific] Successfully refreshed listing ${listingId}`);
      
      return res.status(200).json({
        message: 'Listing refreshed successfully',
        status: data.status,
        refreshedAt: new Date().toISOString()
      });
    } else if (action === 'debug') {
      // Return the current listing data for debugging
      const expiresAt = data.expiresAt instanceof Timestamp 
        ? data.expiresAt.toDate() 
        : new Date(data.expiresAt);
        
      const createdAt = data.createdAt instanceof Timestamp 
        ? data.createdAt.toDate() 
        : new Date(data.createdAt);
      
      return res.status(200).json({
        message: 'Listing data retrieved for debugging',
        id: listingId,
        status: data.status,
        title: data.title,
        game: data.game,
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAt.toISOString(),
        hasImages: Array.isArray(data.imageUrls) && data.imageUrls.length > 0,
        imageCount: Array.isArray(data.imageUrls) ? data.imageUrls.length : 0,
        price: data.price,
        termsAccepted: data.termsAccepted
      });
    }
    
    return res.status(400).json({ error: 'Invalid action. Use "archive", "reactivate", or "debug"' });
  } catch (error: any) {
    console.error('[Fix Specific] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fix listing',
      details: error.message
    });
  }
}