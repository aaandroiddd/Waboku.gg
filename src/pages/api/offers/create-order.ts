import { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase/firestore';

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
    const { offerId, markAsSold } = req.body;
    
    if (!offerId) {
      return res.status(400).json({ message: 'Missing required field: offerId' });
    }
    
    console.log(`Processing order creation for offer ${offerId}, markAsSold=${markAsSold}`);
    
    // Get the offer document
    const offerRef = db.collection('offers').doc(offerId);
    const offerDoc = await offerRef.get();
    
    if (!offerDoc.exists) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    const offerData = offerDoc.data();
    
    // Verify the user is the seller
    if (offerData?.sellerId !== userId) {
      return res.status(403).json({ message: 'Only the seller can create an order from an offer' });
    }
    
    // Verify the offer is accepted
    if (offerData?.status !== 'accepted') {
      return res.status(400).json({ message: 'Only accepted offers can be converted to orders' });
    }
    
    // Create a placeholder shipping address
    const placeholderAddress = {
      name: 'To be provided by buyer',
      line1: 'Address pending',
      city: 'TBD',
      state: 'TBD',
      postal_code: 'TBD',
      country: 'TBD'
    };
    
    // Create the order
    const orderData = {
      listingId: offerData.listingId,
      buyerId: offerData.buyerId,
      sellerId: offerData.sellerId,
      amount: offerData.amount,
      status: 'pending',
      shippingAddress: placeholderAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      listingSnapshot: offerData.listingSnapshot || {
        title: 'Unknown Listing',
        price: offerData.amount || 0,
        imageUrl: ''
      },
      offerId: offerId // Reference to the original offer
    };
    
    // Create the order document
    console.log('Creating order document via server-side API...');
    const orderRef = await db.collection('orders').add(orderData);
    console.log('Order created with ID:', orderRef.id);
    
    // Mark the offer as cleared
    console.log('Marking offer as cleared...');
    await offerRef.update({
      cleared: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // If markAsSold is true, update the listing status to sold
    if (markAsSold) {
      console.log('Marking listing as sold...');
      const listingRef = db.collection('listings').doc(offerData.listingId);
      await listingRef.update({
        status: 'sold',
        soldTo: offerData.buyerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order created successfully',
      orderId: orderRef.id
    });
  } catch (error: any) {
    console.error('Error in create-order API:', error);
    return res.status(500).json({ 
      message: 'Failed to create order', 
      error: error.message 
    });
  }
}