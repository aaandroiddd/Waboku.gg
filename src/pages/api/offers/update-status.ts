import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token from the request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and get the user
    const { admin } = getFirebaseServices();
    const decodedToken = await getAuth(admin).verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get the request body
    const { offerId, status } = req.body;

    // Validate the request body
    if (!offerId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate the status
    if (!['accepted', 'declined', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the offer
    const { db } = getFirebaseServices();
    const offerRef = doc(db, 'offers', offerId);
    const offerSnap = await getDoc(offerRef);

    if (!offerSnap.exists()) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offerData = offerSnap.data();

    // Verify that the user is the seller
    if (offerData.sellerId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to update this offer' });
    }

    // Update the offer status
    await updateDoc(offerRef, {
      status,
      updatedAt: serverTimestamp()
    });

    return res.status(200).json({ 
      success: true, 
      message: `Offer ${status} successfully` 
    });
  } catch (error) {
    console.error('Error updating offer status:', error);
    return res.status(500).json({ error: 'Failed to update offer status' });
  }
}