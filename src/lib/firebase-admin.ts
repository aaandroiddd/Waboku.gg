import * as admin from 'firebase-admin';

interface FirebaseAdminServices {
  db: admin.firestore.Firestore;
  auth: admin.auth.Auth;
  storage: admin.storage.Storage;
  rtdb: admin.database.Database;
  Timestamp: typeof admin.firestore.Timestamp;
}

let firebaseAdmin: FirebaseAdminServices | null = null;

export function getFirebaseAdmin(): FirebaseAdminServices {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error) {
      console.error('Firebase admin initialization error:', error);
      throw error;
    }
  }

  firebaseAdmin = {
    db: admin.firestore(),
    auth: admin.auth(),
    storage: admin.storage(),
    rtdb: admin.database(),
    Timestamp: admin.firestore.Timestamp,
  };

  return firebaseAdmin;
}