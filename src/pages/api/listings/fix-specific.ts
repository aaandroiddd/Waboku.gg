import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Fix Specific] Starting fix process for specific listing');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Specific listing ID to fix
  const listingId = 'r3R4M3uMDEUeOThMwCA8';
  
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
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    // Archive the listing
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
  } catch (error: any) {
    console.error('[Fix Specific] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fix listing',
      details: error.message
    });
  }
}