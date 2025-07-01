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

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    // Get recent orders to check shipping information
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        listingId: data.listingId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        amount: data.amount,
        status: data.status,
        paymentSessionId: data.paymentSessionId,
        hasShippingAddress: !!data.shippingAddress,
        shippingAddress: data.shippingAddress ? {
          name: data.shippingAddress.name,
          city: data.shippingAddress.city,
          state: data.shippingAddress.state,
          country: data.shippingAddress.country
        } : null,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        listingSnapshot: data.listingSnapshot
      };
    });

    // Count orders with and without shipping addresses
    const withShipping = orders.filter(order => order.hasShippingAddress).length;
    const withoutShipping = orders.filter(order => !order.hasShippingAddress).length;

    return res.status(200).json({
      summary: {
        totalOrders: orders.length,
        withShippingAddress: withShipping,
        withoutShippingAddress: withoutShipping,
        percentageWithShipping: orders.length > 0 ? Math.round((withShipping / orders.length) * 100) : 0
      },
      recentOrders: orders,
      analysis: {
        message: withoutShipping > 0 
          ? `${withoutShipping} out of ${orders.length} recent orders are missing shipping addresses. This suggests the Stripe checkout may not be collecting shipping information properly.`
          : 'All recent orders have shipping addresses. The system appears to be working correctly.'
      }
    });
  } catch (error) {
    console.error('Error testing buy now shipping:', error);
    return res.status(500).json({ 
      error: 'Failed to test buy now shipping',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}