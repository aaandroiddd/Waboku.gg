import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/offers/create START');
  
  // Log environment variables availability (without values)
  console.log('Environment variables check:', {
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
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
        stack: adminInitError.stack,
        code: adminInitError.code,
        name: adminInitError.name
      });
      return res.status(500).json({ 
        error: 'Failed to initialize Firebase Admin',
        details: adminInitError.message
      });
    }
    
    // Get Auth and Firestore instances
    console.log('Getting Auth and Firestore instances...');
    let auth;
    let db;
    
    try {
      auth = getAuth(admin);
      db = getFirestore(admin);
      console.log('Successfully got Auth and Firestore instances');
    } catch (instanceError: any) {
      console.error('Error getting Auth or Firestore instance:', {
        message: instanceError.message,
        stack: instanceError.stack,
        code: instanceError.code
      });
      return res.status(500).json({
        error: 'Failed to initialize Firebase services',
        details: instanceError.message
      });
    }
    
    // Verify the token
    console.log('Verifying token...');
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('Token verified successfully');
    } catch (tokenError: any) {
      console.error('Token verification error:', {
        message: tokenError.message,
        code: tokenError.code,
        stack: tokenError.stack
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
      // Verify Firestore connection by checking if we can access the collection
      const testQuery = await db.collection('offers').limit(1).get();
      console.log(`Firestore connection test: able to query offers collection (${testQuery.size} results)`);
      
      // Now add the document
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
        stack: firestoreError.stack,
        name: firestoreError.name
      });
      
      // Check for specific Firestore errors
      let errorDetails = firestoreError.message;
      let statusCode = 500;
      
      if (firestoreError.code === 'permission-denied') {
        errorDetails = 'Permission denied. The service account may not have write access to the Firestore collection.';
        statusCode = 403;
      } else if (firestoreError.code === 'resource-exhausted') {
        errorDetails = 'Resource quota exceeded. Please try again later.';
        statusCode = 429;
      } else if (firestoreError.code === 'unavailable') {
        errorDetails = 'Firestore service is currently unavailable. Please try again later.';
        statusCode = 503;
      }
      
      return res.status(statusCode).json({ 
        error: 'Failed to create offer in database',
        message: errorDetails,
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