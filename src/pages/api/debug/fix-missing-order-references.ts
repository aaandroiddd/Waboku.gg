import { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const { admin, db } = initializeFirebaseAdmin();
    
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and get the user
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified for user:', decodedToken.uid);
    } catch (error: any) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication token' });
    }
    
    const userId = decodedToken.uid;
    
    // Get request body
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ message: 'Missing required field: orderId' });
    }
    
    console.log(`Fixing missing order references for order ${orderId}`);
    
    // Get the order document
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const orderData = orderDoc.data();
    
    // Verify the user is either the buyer or seller
    if (orderData?.buyerId !== userId && orderData?.sellerId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to fix this order' });
    }
    
    // Create references in user-specific subcollections for both buyer and seller
    console.log('Creating user-specific order references...');
    
    // Create buyer's order reference
    await db.collection('users').doc(orderData.buyerId).collection('orders').doc(orderId).set({
      orderId: orderId,
      role: 'buyer',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Created buyer's order reference for user ${orderData.buyerId}`);
    
    // Create seller's order reference
    await db.collection('users').doc(orderData.sellerId).collection('orders').doc(orderId).set({
      orderId: orderId,
      role: 'seller',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Created seller's order reference for user ${orderData.sellerId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order references created successfully',
      orderId: orderId
    });
  } catch (error: any) {
    console.error('Error in fix-missing-order-references API:', error);
    return res.status(500).json({ 
      message: 'Failed to fix order references', 
      error: error.message 
    });
  }
}