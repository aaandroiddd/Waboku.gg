import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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

    // Create the offer using admin SDK to bypass security rules
    // This is safe because we've already verified the user's identity with the token
    const adminDb = getFirestore(admin);
    
    // Log the operation for debugging
    console.log(`Creating offer for listing ${listingId} by buyer ${userId} to seller ${sellerId}`);
    
    const offerData = {
      listingId,
      buyerId: userId,
      sellerId,
      amount,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      listingSnapshot
    };
    
    const offerRef = await adminDb.collection('offers').add(offerData);
    
    console.log(`Successfully created offer with ID: ${offerRef.id}`);

    return res.status(201).json({ 
      success: true, 
      offerId: offerRef.id,
      message: 'Offer created successfully' 
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    // Check for specific Firebase errors
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return res.status(403).json({ 
        error: 'Permission denied. You may not have the necessary permissions to create an offer.',
        details: errorMessage
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to create offer',
      details: errorMessage
    });
  }
}