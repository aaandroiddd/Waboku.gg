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
    let completedSalesCount = 0;

    // Count only completed orders
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      
      // Only count orders that are completed
      if (order.status === 'completed') {
        totalSales += order.amount || 0;
        completedSalesCount++;
      }
    });

    console.log(`[Calculate Total Sales] User ${userId}: ${completedSalesCount} completed sales, total amount: $${totalSales}`);

    return res.status(200).json({
      userId,
      totalSales: completedSalesCount,
      totalSalesAmount: totalSales,
      completedOrdersCount: completedSalesCount
    });

  } catch (error) {
    console.error('Error calculating total sales:', error);
    return res.status(500).json({ error: 'Failed to calculate total sales' });
  }
}