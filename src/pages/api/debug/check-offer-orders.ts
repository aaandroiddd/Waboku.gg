import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret for security
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('Invalid admin secret provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();

    console.log('[Debug] Checking for orders with offer prices');

    // Query orders that have an offerPrice field
    const ordersWithOfferQuery = await firestoreDb.collection('orders')
      .where('offerPrice', '>', 0)
      .limit(10)
      .get();

    if (ordersWithOfferQuery.empty) {
      console.log('[Debug] No orders with offer prices found');
      return res.status(200).json({
        found: false,
        message: 'No orders with offer prices found'
      });
    }

    // Format the results
    const orders = ordersWithOfferQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        listingId: data.listingId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        status: data.status,
        amount: data.amount,
        offerPrice: data.offerPrice,
        createdAt: data.createdAt?.toDate?.() 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
      };
    });

    console.log(`[Debug] Found ${orders.length} orders with offer prices`);
    
    return res.status(200).json({
      found: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error checking offer orders:', error);
    return res.status(500).json({ 
      error: 'Failed to check offer orders',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}