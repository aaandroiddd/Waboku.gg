import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  listingId?: string;
  deleteAt?: string;
  timeUntilDeletion?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const authHeader = req.headers.authorization;
  const adminSecret = req.headers['x-admin-secret'] as string;
  
  if (!authHeader?.startsWith('Bearer ') && !adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader?.replace('Bearer ', '') || adminSecret;
  
  if (token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  try {
    // Get Firebase admin instance
    const admin = getFirebaseAdmin();
    
    if (!admin.firestore) {
      console.error('[Test TTL Archive] Firestore not available on admin instance');
      return res.status(500).json({ 
        error: 'Failed to initialize Firestore',
        details: 'Firestore not available on admin instance'
      });
    }
    
    const db = admin.firestore();
    console.log('[Test TTL Archive] Firestore initialized successfully');

    // Get listing ID from request body
    const { listingId: targetListingId } = req.body;
    
    let listingId: string;
    let listingData: any;

    if (targetListingId) {
      // Use the specific listing ID provided
      console.log(`[Test TTL Archive] Using specific listing ID: ${targetListingId}`);
      const listingDoc = await db.collection('listings').doc(targetListingId).get();
      
      if (!listingDoc.exists) {
        return res.status(404).json({ 
          error: 'Listing not found',
          message: `No listing found with ID: ${targetListingId}`
        });
      }
      
      listingId = listingDoc.id;
      listingData = listingDoc.data();
    } else {
      // Find an active listing to test with (original behavior)
      console.log('[Test TTL Archive] No specific listing ID provided, finding an active listing');
      const listingsSnapshot = await db
        .collection('listings')
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (listingsSnapshot.empty) {
        return res.status(404).json({ 
          error: 'No active listings found to test with',
          message: 'Create an active listing first or provide a specific listing ID to test the TTL functionality'
        });
      }

      const listingDoc = listingsSnapshot.docs[0];
      listingId = listingDoc.id;
      listingData = listingDoc.data();
    }

    // Calculate TTL for 1 minute from now
    const now = new Date();
    const deleteAt = new Date(now.getTime() + (1 * 60 * 1000)); // 1 minute
    const deleteAtTimestamp = Timestamp.fromDate(deleteAt);

    // Update the listing with archived status and 1-minute TTL
    await db.collection('listings').doc(listingId).update({
      status: 'archived',
      archivedAt: Timestamp.now(),
      deleteAt: deleteAtTimestamp, // Firestore TTL field
      ttlSetAt: Timestamp.now(),
      ttlReason: 'admin_test_1_minute',
      // Keep original data for reference
      originalStatus: listingData.status,
      testArchived: true
    });

    const timeUntilDeletion = Math.round((deleteAt.getTime() - now.getTime()) / 1000);

    return res.status(200).json({
      success: true,
      message: 'Listing archived with 1-minute TTL for testing',
      listingId,
      deleteAt: deleteAt.toISOString(),
      timeUntilDeletion: `${timeUntilDeletion} seconds`,
    });

  } catch (error) {
    console.error('Error in test TTL archive:', error);
    return res.status(500).json({
      error: 'Failed to archive listing with TTL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}