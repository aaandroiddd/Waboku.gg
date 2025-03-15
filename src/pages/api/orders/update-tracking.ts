import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { Order } from '@/types/order';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const { admin } = getFirebaseServices();
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;
    const { orderId, carrier, trackingNumber, notes } = req.body;

    if (!orderId || !carrier || !trackingNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the order
    const { db } = getFirebaseServices();
    const orderDoc = await getDoc(doc(db, 'orders', orderId));

    if (!orderDoc.exists()) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data() as Order;

    // Check if the user is the seller
    if (orderData.sellerId !== userId) {
      return res.status(403).json({ error: 'Only the seller can update tracking information' });
    }

    // Update the order with tracking information
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'shipped',
      trackingInfo: {
        carrier,
        trackingNumber,
        notes: notes || '',
        addedAt: new Date(),
        addedBy: userId
      },
      trackingRequired: true,
      updatedAt: new Date()
    });

    return res.status(200).json({ success: true, message: 'Tracking information updated successfully' });
  } catch (error) {
    console.error('Error updating tracking information:', error);
    return res.status(500).json({ error: 'Failed to update tracking information' });
  }
}