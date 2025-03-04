import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/offers/create START');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token from the request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    try {
      // Initialize Firebase Admin
      console.log('Initializing Firebase Admin...');
      const admin = getFirebaseAdmin();
      
      // Get Auth and Firestore instances
      console.log('Getting Auth and Firestore instances...');
      const auth = getAuth(admin);
      const db = getFirestore(admin);
      
      // Verify the token
      console.log('Verifying token...');
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      console.log(`Authenticated user: ${userId}`);

      // Get the request body
      const { listingId, sellerId, amount, listingSnapshot } = req.body;
      console.log('Request body:', { listingId, sellerId, amount, listingSnapshot: !!listingSnapshot });

      // Validate the request body
      if (!listingId || !sellerId || !amount || !listingSnapshot) {
        console.error('Missing required fields in request body');
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Prevent users from making offers on their own listings
      if (userId === sellerId) {
        console.error('User attempted to make an offer on their own listing');
        return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
      }

      // Create the offer using admin SDK to bypass security rules
      // This is safe because we've already verified the user's identity with the token
      console.log(`Creating offer for listing ${listingId} by buyer ${userId} to seller ${sellerId}`);
      
      const offerData = {
        listingId,
        buyerId: userId,
        sellerId,
        amount,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        listingSnapshot: {
          title: listingSnapshot.title || 'Unknown Listing',
          price: listingSnapshot.price || 0,
          imageUrl: listingSnapshot.imageUrl || '',
        }
      };
      
      try {
        const offerRef = await db.collection('offers').add(offerData);
        console.log(`Successfully created offer with ID: ${offerRef.id}`);

        return res.status(201).json({ 
          success: true, 
          offerId: offerRef.id,
          message: 'Offer created successfully' 
        });
      } catch (firestoreError: any) {
        console.error('Error adding document to Firestore:', firestoreError);
        return res.status(500).json({ 
          error: 'Failed to create offer in database',
          message: firestoreError.message,
          code: firestoreError.code
        });
      }
    } catch (authError: any) {
      console.error('Error with Firebase Admin or authentication:', authError);
      return res.status(500).json({ 
        error: 'Failed to authenticate or initialize Firebase',
        message: authError.message,
        code: authError.code
      });
    }
  } catch (error: any) {
    console.error('Error creating offer:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
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
  } finally {
    console.log('POST /api/offers/create END');
  }
}