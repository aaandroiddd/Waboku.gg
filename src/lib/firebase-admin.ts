import * as admin from 'firebase-admin';

interface FirebaseAdminServices {
  db: admin.firestore.Firestore;
  auth: admin.auth.Auth;
  storage: admin.storage.Storage;
  rtdb: admin.database.Database;
  getFirestore: () => admin.firestore.Firestore;
}

let firebaseAdmin: FirebaseAdminServices | null = null;

export function getFirebaseAdmin(): FirebaseAdminServices {
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
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error: any) {
      console.error('Firebase admin initialization error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        name: error.name
      });
      throw error;
    }
  }

  firebaseAdmin = {
    db: admin.firestore(),
    auth: admin.auth(),
    storage: admin.storage(),
    rtdb: admin.database(),
    getFirestore: () => admin.firestore(),
  };

  return firebaseAdmin;
}