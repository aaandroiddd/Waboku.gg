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
    
    // Initialize Firebase Admin
    console.log('Initializing Firebase Admin...');
    let admin;
    try {
      admin = getFirebaseAdmin();
      console.log('Firebase Admin initialized successfully');
    } catch (adminInitError: any) {
      console.error('Firebase Admin initialization error:', {
        message: adminInitError.message,
        stack: adminInitError.stack
      });
      return res.status(500).json({ 
        error: 'Failed to initialize Firebase Admin',
        details: adminInitError.message
      });
    }
    
    // Get Auth and Firestore instances
    console.log('Getting Auth and Firestore instances...');
    const auth = getAuth(admin);
    const db = getFirestore(admin);
    
    // Verify the token
    console.log('Verifying token...');
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (tokenError: any) {
      console.error('Token verification error:', {
        message: tokenError.message,
        code: tokenError.code
      });
      return res.status(401).json({ 
        error: 'Invalid authentication token',
        details: tokenError.message
      });
    }
    
    const userId = decodedToken.uid;
    console.log(`Authenticated user: ${userId}`);

    // Get the request body
    const { listingId, sellerId, amount, listingSnapshot } = req.body;
    console.log('Request body:', { 
      listingId, 
      sellerId, 
      amount, 
      listingSnapshot: listingSnapshot ? {
        title: listingSnapshot.title,
        price: listingSnapshot.price,
        hasImage: !!listingSnapshot.imageUrl
      } : null 
    });

    // Validate the request body
    if (!listingId || !sellerId || !amount) {
      console.error('Missing required fields in request body');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!listingSnapshot) {
      console.error('Missing listingSnapshot in request body');
      return res.status(400).json({ error: 'Missing listing snapshot data' });
    }

    // Prevent users from making offers on their own listings
    if (userId === sellerId) {
      console.error('User attempted to make an offer on their own listing');
      return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
    }

    // Create the offer using admin SDK to bypass security rules
    console.log(`Creating offer for listing ${listingId} by buyer ${userId} to seller ${sellerId}`);
    
    const offerData = {
      listingId,
      buyerId: userId,
      sellerId,
      amount: Number(amount), // Ensure amount is a number
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
      console.error('Error adding document to Firestore:', {
        message: firestoreError.message,
        code: firestoreError.code,
        stack: firestoreError.stack
      });
      return res.status(500).json({ 
        error: 'Failed to create offer in database',
        message: firestoreError.message,
        code: firestoreError.code
      });
    }
  } catch (error: any) {
    console.error('Unhandled error creating offer:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Failed to create offer',
      details: error.message
    });
  } finally {
    console.log('POST /api/offers/create END');
  }
}