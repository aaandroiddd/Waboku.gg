import * as admin from 'firebase-admin';

let firebaseAdmin: typeof admin | null = null;

export function getFirebaseAdmin(): typeof admin {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  if (!admin.apps.length) {
    try {
      // Validate required environment variables
      const requiredEnvVars = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      };

      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        console.error('Missing required Firebase Admin environment variables:', missingVars);
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      // Log initialization attempt
      console.log('[Firebase Admin] Initializing with config:', {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 10) + '...',
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!privateKey) {
        throw new Error('Invalid FIREBASE_PRIVATE_KEY format');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

      console.log('[Firebase Admin] Successfully initialized');
    } catch (error: any) {
      console.error('[Firebase Admin] Initialization error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        name: error.name
      });
      throw error;
    }
  }

  firebaseAdmin = admin;
  return firebaseAdmin;
}