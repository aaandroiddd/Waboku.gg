import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { verifyIdToken } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);

    // Check if user is admin
    if (!decodedToken.admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { db } = getFirebaseServices();

    // Query orders with refund requests
    const ordersQuery = query(
      collection(db, 'orders'),
      where('refundStatus', 'in', ['requested', 'processing', 'completed', 'failed', 'cancelled']),
      orderBy('refundRequestedAt', 'desc')
    );

    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        refundRequestedAt: data.refundRequestedAt?.toDate() || null,
        refundProcessedAt: data.refundProcessedAt?.toDate() || null,
      };
    });

    return res.status(200).json({ 
      success: true, 
      orders,
      count: orders.length,
    });

  } catch (error) {
    console.error('Error fetching refund orders:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}