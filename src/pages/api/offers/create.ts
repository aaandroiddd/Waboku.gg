import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
    const { listingId, sellerId, amount, listingSnapshot } = req.body;

    // Validate the request body
    if (!listingId || !sellerId || !amount || !listingSnapshot) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prevent users from making offers on their own listings
    if (userId === sellerId) {
      return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
    }

    // Create the offer
    const { db } = getFirebaseServices();
    const offerRef = await addDoc(collection(db, 'offers'), {
      listingId,
      buyerId: userId,
      sellerId,
      amount,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      listingSnapshot
    });

    return res.status(201).json({ 
      success: true, 
      offerId: offerRef.id,
      message: 'Offer created successfully' 
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    return res.status(500).json({ error: 'Failed to create offer' });
  }
}