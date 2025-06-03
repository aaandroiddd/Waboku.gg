import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const { db } = getFirebaseAdmin();

    // Query all orders where the user is the seller
    const ordersSnapshot = await db
      .collection('orders')
      .where('sellerId', '==', userId)
      .get();

    let totalSales = 0;
    let salesCount = 0;

    // Count completed, shipped, and pending orders with accepted offers
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      
      // Count orders that represent successful sales:
      // - completed: fully finished transactions
      // - shipped: items have been sent to buyer
      // - pending with accepted offers: confirmed sales awaiting payment/shipment
      if (order.status === 'completed' || 
          order.status === 'shipped' || 
          (order.status === 'pending' && order.acceptedOffer)) {
        totalSales += order.amount || 0;
        salesCount++;
      }
    });

    console.log(`[Calculate Total Sales] User ${userId}: ${salesCount} total sales (completed/shipped/accepted offers), total amount: $${totalSales}`);

    return res.status(200).json({
      userId,
      totalSales: salesCount,
      totalSalesAmount: totalSales,
      completedOrdersCount: salesCount
    });

  } catch (error) {
    console.error('Error calculating total sales:', error);
    return res.status(500).json({ error: 'Failed to calculate total sales' });
  }
}