import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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
    console.log(`[Fix Expired] Processing listing: ${listingId}`);
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
    
    // If the listing is expired or has the "Listing expired" UI state, archive it
    if (data.status === 'expired' || data.status === 'active') {
      const batch = db.batch();
      
      console.log(`[Fix Expired] Archiving listing ${listingId}`);
      batch.update(listingRef, {
        status: 'archived',
        archivedAt: Timestamp.now(),
        originalCreatedAt: data.createdAt,
        updatedAt: Timestamp.now(),
        expirationReason: 'manual_fix'
      });
      
      await batch.commit();
      console.log(`[Fix Expired] Successfully archived listing ${listingId}`);
      
      return res.status(200).json({
        message: `Successfully archived listing ${listingId}`,
        previousStatus: data.status,
        currentStatus: 'archived'
      });
    } else {
      console.log(`[Fix Expired] Listing ${listingId} has status ${data.status}, not archiving`);
      return res.status(200).json({
        message: `Listing ${listingId} already has status ${data.status}, no action taken`,
        status: data.status
      });
    }
  } catch (error: any) {
    logError('Fix expired listing', error);
    return res.status(500).json({ 
      error: 'Failed to fix listing',
      details: error.message,
      stack: error.stack
    });
  }
}