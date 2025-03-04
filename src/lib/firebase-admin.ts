import * as admin from 'firebase-admin';

let firebaseAdmin: typeof admin | null = null;
let adminApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin app and return both the admin instance and the app
 */
export function initializeAdminApp() {
  if (adminApp) {
    return { admin: firebaseAdmin as typeof admin, app: adminApp };
  }
  
  const admin = getFirebaseAdmin();
  adminApp = admin.app();
  
  return { admin, app: adminApp };
}

/**
 * Initialize Firebase Admin and return the admin instance
 */
export function initAdmin(): typeof admin {
  return getFirebaseAdmin();
}

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
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      };
      
      // Check if API key is configured (for client-side auth)
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        console.warn('[Firebase Admin] NEXT_PUBLIC_FIREBASE_API_KEY is missing - client-side auth may fail');
      }

      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        console.error('[Firebase Admin] Missing required environment variables:', missingVars);
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      // Log initialization attempt
      console.log('[Firebase Admin] Initializing with config:', {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 10) + '...',
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '(not provided)',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

      // Handle private key properly - it might be encoded with escaped newlines
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('[Firebase Admin] Invalid FIREBASE_PRIVATE_KEY - value is empty or undefined');
      }
      
      // Replace escaped newlines with actual newlines if needed
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
        console.log('[Firebase Admin] Processed private key with escaped newlines');
      }

      // Create the credential object
      const credential = admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      });

      // Prepare the initialization options
      const options: admin.AppOptions = {
        credential: credential,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      };

      // Add databaseURL only if it exists
      if (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
        options.databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      }

      // Initialize the app with the credentials
      admin.initializeApp(options);
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
  } else {
    console.log('[Firebase Admin] Using existing Firebase Admin app');
  }

  firebaseAdmin = admin;
  return firebaseAdmin;
}