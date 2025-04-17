import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/offers/create START');
  
  // Log environment variables availability (without values)
  console.log('Environment variables check:', {
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY?.substring(0, 5) + '...',
    FIREBASE_PRIVATE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
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
    let firebaseAdminInstance;
    try {
      firebaseAdminInstance = getFirebaseAdmin();
      console.log('Firebase Admin initialized successfully', {
        isAdmin: !!firebaseAdminInstance,
        adminType: typeof firebaseAdminInstance,
        hasApps: Array.isArray(firebaseAdminInstance?.apps),
        appsLength: firebaseAdminInstance?.apps?.length || 0
      });
    } catch (adminInitError: any) {
      console.error('Firebase Admin initialization error:', {
        message: adminInitError.message,
        stack: adminInitError.stack,
        code: adminInitError.code,
        name: adminInitError.name,
        // Additional debugging info
        envVars: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasPublicProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
          privateKeyStart: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 10) + '...' : 'undefined'
        }
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
      // Use the default app instead of passing admin directly
      auth = getAuth();
      db = getFirestore();
      console.log('Successfully got Auth and Firestore instances');
    } catch (instanceError: any) {
      console.error('Error getting Auth or Firestore instance:', {
        message: instanceError.message,
        stack: instanceError.stack,
        code: instanceError.code,
        name: instanceError.name
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
        stack: tokenError.stack,
        name: tokenError.name
      });
      return res.status(401).json({ 
        error: 'Invalid authentication token',
        details: tokenError.message
      });
    }
    
    const userId = decodedToken.uid;
    console.log(`Authenticated user: ${userId}`);

    // Get the request body
    const { listingId, sellerId, amount, listingSnapshot, shippingAddress, isPickup, requiresShippingInfo } = req.body;
    console.log('Request body:', { 
      listingId, 
      sellerId, 
      amount, 
      listingSnapshot: listingSnapshot ? {
        title: listingSnapshot.title,
        price: listingSnapshot.price,
        hasImage: !!listingSnapshot.imageUrl
      } : null,
      hasShippingAddress: !!shippingAddress,
      isPickup: !!isPickup,
      requiresShippingInfo: !!requiresShippingInfo
    });

    // Validate the request body
    if (!listingId || !sellerId || amount === undefined || amount === null) {
      console.error('Missing required fields in request body:', { 
        hasListingId: !!listingId, 
        hasSellerId: !!sellerId, 
        amount: amount 
      });
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
    
    // Ensure amount is a valid number
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error('Invalid amount value:', amount);
      return res.status(400).json({ error: 'Offer amount must be a positive number' });
    }
    
    // Check if the user already has an active offer for this listing
    try {
      console.log(`Checking for existing offers from buyer ${userId} for listing ${listingId}`);
      const existingOffersQuery = await db.collection('offers')
        .where('buyerId', '==', userId)
        .where('listingId', '==', listingId)
        .where('status', '==', 'pending')
        .get();
      
      if (!existingOffersQuery.empty) {
        console.log(`Found existing pending offer from buyer ${userId} for listing ${listingId}`);
        return res.status(400).json({ 
          error: 'You already have an active offer for this listing',
          message: 'You can only have one active offer per listing at a time'
        });
      }
    } catch (checkError: any) {
      console.error('Error checking for existing offers:', {
        message: checkError.message,
        code: checkError.code,
        stack: checkError.stack
      });
      // Continue with offer creation even if check fails
    }
    
    const offerData = {
      listingId,
      buyerId: userId,
      sellerId,
      amount: numericAmount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      listingSnapshot: {
        title: listingSnapshot.title || 'Unknown Listing',
        price: listingSnapshot.price || 0,
        imageUrl: listingSnapshot.imageUrl || '',
      },
      shippingAddress: shippingAddress || null,
      isPickup: isPickup || false,
      requiresShippingInfo: requiresShippingInfo || false,
      shippingInfoProvided: false
    };
    
    try {
      // Verify Firestore connection by checking if we can access the collection
      console.log('Testing Firestore connection...');
      try {
        const testQuery = await db.collection('offers').limit(1).get();
        console.log(`Firestore connection test: able to query offers collection (${testQuery.size} results)`);
      } catch (testError: any) {
        console.error('Firestore connection test failed:', {
          message: testError.message,
          code: testError.code,
          name: testError.name
        });
        throw testError; // Re-throw to be caught by the outer catch block
      }
      
      // Now add the document
      console.log('Adding offer document to Firestore...');
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
        name: firestoreError.name,
        // Additional context
        operation: 'db.collection(offers).add',
        offerData: {
          listingId: offerData.listingId,
          buyerId: offerData.buyerId,
          sellerId: offerData.sellerId,
          amount: offerData.amount,
          status: offerData.status
        }
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
      } else if (firestoreError.code === 'not-found') {
        errorDetails = 'The specified Firestore collection does not exist.';
        statusCode = 404;
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
      code: error.code,
      // Additional context
      requestBody: req.body ? {
        hasListingId: !!req.body.listingId,
        hasSellerId: !!req.body.sellerId,
        hasAmount: req.body.amount !== undefined,
        hasListingSnapshot: !!req.body.listingSnapshot
      } : 'No request body'
    });
    
    return res.status(500).json({ 
      error: 'Failed to create offer',
      details: error.message
    });
  } finally {
    console.log('POST /api/offers/create END');
  }
}