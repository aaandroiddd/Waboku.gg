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

    // Get the session ID from the request
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    console.log('[Debug] Checking for existing order with session ID:', sessionId);

    // Check if an order with this session ID already exists
    const ordersQuery = await firestoreDb.collection('orders')
      .where('paymentSessionId', '==', sessionId)
      .limit(1)
      .get();

    if (!ordersQuery.empty) {
      const existingOrder = ordersQuery.docs[0];
      return res.status(200).json({
        exists: true,
        order: {
          id: existingOrder.id,
          ...existingOrder.data(),
          createdAt: existingOrder.data().createdAt?.toDate?.() 
            ? existingOrder.data().createdAt.toDate().toISOString() 
            : existingOrder.data().createdAt,
        }
      });
    }

    return res.status(200).json({
      exists: false,
      message: 'No order found with the provided session ID'
    });
  } catch (error) {
    console.error('Error checking order:', error);
    return res.status(500).json({ 
      error: 'Failed to check order',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}