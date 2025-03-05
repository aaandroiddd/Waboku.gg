import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('GET /api/admin/check-firebase-config START');
  
  // Only allow this in development or with admin secret
  const isDevEnvironment = process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development';
  const adminSecret = req.headers['x-admin-secret'];
  const isAuthorized = isDevEnvironment || adminSecret === process.env.ADMIN_SECRET;
  
  if (!isAuthorized) {
    console.log('Unauthorized access attempt to check-firebase-config');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check environment variables (without exposing values)
    const envVarCheck = {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_PRIVATE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_DATABASE_URL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    };
    
    console.log('Environment variables check:', envVarCheck);
    
    // Initialize Firebase Admin
    console.log('Attempting to initialize Firebase Admin...');
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
        success: false,
        error: 'Failed to initialize Firebase Admin',
        details: adminInitError.message,
        envVarCheck
      });
    }
    
    // Test Auth service
    console.log('Testing Auth service...');
    try {
      const auth = getAuth(admin);
      // Just check if we can access the auth object
      console.log('Auth service initialized successfully');
    } catch (authError: any) {
      console.error('Auth service error:', {
        message: authError.message,
        stack: authError.stack,
        code: authError.code,
        name: authError.name
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Auth service',
        details: authError.message,
        envVarCheck
      });
    }
    
    // Test Firestore service
    console.log('Testing Firestore service...');
    try {
      const db = getFirestore(admin);
      // Try to access a collection to verify connection
      const testQuery = await db.collection('offers').limit(1).get();
      console.log(`Firestore connection test: able to query offers collection (${testQuery.size} results)`);
    } catch (firestoreError: any) {
      console.error('Firestore service error:', {
        message: firestoreError.message,
        stack: firestoreError.stack,
        code: firestoreError.code,
        name: firestoreError.name
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to connect to Firestore',
        details: firestoreError.message,
        envVarCheck
      });
    }
    
    // All tests passed
    return res.status(200).json({
      success: true,
      message: 'Firebase Admin configuration is valid',
      envVarCheck
    });
  } catch (error: any) {
    console.error('Unhandled error checking Firebase config:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to check Firebase configuration',
      details: error.message
    });
  } finally {
    console.log('GET /api/admin/check-firebase-config END');
  }
}