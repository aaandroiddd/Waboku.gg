import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
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

    console.log('[Debug] Checking for orders with offer prices that need user references');

    // Query orders that have an offerPrice field
    const ordersWithOfferQuery = await firestoreDb.collection('orders')
      .where('offerPrice', '>', 0)
      .get();

    if (ordersWithOfferQuery.empty) {
      console.log('[Debug] No orders with offer prices found');
      return res.status(200).json({
        found: false,
        message: 'No orders with offer prices found'
      });
    }

    console.log(`[Debug] Found ${ordersWithOfferQuery.docs.length} orders with offer prices`);
    
    // Track fixed orders
    const fixedOrders = [];
    
    // For each order, ensure it has user-specific references
    for (const orderDoc of ordersWithOfferQuery.docs) {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      const buyerId = orderData.buyerId;
      const sellerId = orderData.sellerId;
      
      console.log(`[Debug] Processing order ${orderId} for buyer ${buyerId} and seller ${sellerId}`);
      
      // Check if buyer reference exists
      const buyerRefQuery = await firestoreDb.collection('users')
        .doc(buyerId)
        .collection('orders')
        .doc(orderId)
        .get();
        
      // Check if seller reference exists
      const sellerRefQuery = await firestoreDb.collection('users')
        .doc(sellerId)
        .collection('orders')
        .doc(orderId)
        .get();
      
      let fixed = false;
      
      // Create buyer reference if missing
      if (!buyerRefQuery.exists) {
        console.log(`[Debug] Creating missing buyer reference for order ${orderId}`);
        await firestoreDb.collection('users')
          .doc(buyerId)
          .collection('orders')
          .doc(orderId)
          .set({
            orderId: orderId,
            role: 'buyer',
            createdAt: orderData.createdAt || new Date()
          });
        fixed = true;
      }
      
      // Create seller reference if missing
      if (!sellerRefQuery.exists) {
        console.log(`[Debug] Creating missing seller reference for order ${orderId}`);
        await firestoreDb.collection('users')
          .doc(sellerId)
          .collection('orders')
          .doc(orderId)
          .set({
            orderId: orderId,
            role: 'seller',
            createdAt: orderData.createdAt || new Date()
          });
        fixed = true;
      }
      
      if (fixed) {
        fixedOrders.push({
          id: orderId,
          buyerId,
          sellerId
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      totalOrders: ordersWithOfferQuery.docs.length,
      fixedOrders: fixedOrders,
      fixedCount: fixedOrders.length
    });
  } catch (error) {
    console.error('Error fixing offer orders:', error);
    return res.status(500).json({ 
      error: 'Failed to fix offer orders',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}