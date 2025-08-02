import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/offers/clear-expired-declined START');
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (!authResult.success) {
      console.error('Authentication failed:', authResult.error);
      return res.status(401).json({ error: authResult.error || 'Unauthorized' });
    }

    const userId = authResult.uid!;
    console.log(`Authenticated user: ${userId}`);

    const { db } = getFirebaseAdmin();

    // Get all offers for the user that are either expired or declined
    const offersSnapshot = await db
      .collection('offers')
      .where('buyerId', '==', userId)
      .get();

    const batch = db.batch();
    let deletedCount = 0;

    for (const doc of offersSnapshot.docs) {
      const offer = doc.data();
      const now = new Date();
      const expiresAt = offer.expiresAt?.toDate();
      
      // Check if offer is expired or declined
      const isExpired = expiresAt && expiresAt < now;
      const isDeclined = offer.status === 'declined';
      
      if (isExpired || isDeclined) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    }

    // Also check offers where user is the seller (received offers)
    const receivedOffersSnapshot = await db
      .collection('offers')
      .where('sellerId', '==', userId)
      .get();

    for (const doc of receivedOffersSnapshot.docs) {
      const offer = doc.data();
      const now = new Date();
      const expiresAt = offer.expiresAt?.toDate();
      
      // Check if offer is expired or declined
      const isExpired = expiresAt && expiresAt < now;
      const isDeclined = offer.status === 'declined';
      
      if (isExpired || isDeclined) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
    }

    res.status(200).json({ 
      success: true, 
      message: `Successfully cleared ${deletedCount} expired and declined offers`,
      deletedCount 
    });

  } catch (error: any) {
    console.error('Error clearing expired/declined offers:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Failed to clear offers',
      details: error.message
    });
  } finally {
    console.log('POST /api/offers/clear-expired-declined END');
  }
}