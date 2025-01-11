import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  Firestore
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export const getFirebaseServices = () => {
  if (typeof window === 'undefined') {
    return { app: undefined, auth: undefined, db: undefined, storage: undefined };
  }

  if (!app) {
    // Check if all required environment variables are present
    const missingVars = Object.entries(firebaseConfig)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.warn('Missing Firebase configuration:', missingVars);
      return { app: undefined, auth: undefined, db: undefined, storage: undefined };
    }

    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);

      // Set auth persistence
      if (auth) {
        setPersistence(auth, browserLocalPersistence)
          .catch(error => console.error('Error setting auth persistence:', error));
      }
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      return { app: undefined, auth: undefined, db: undefined, storage: undefined };
    }
  }

  return { app, auth, db, storage };
};

// Initialize Firebase on import
if (typeof window !== 'undefined') {
  getFirebaseServices();
}

export { app, auth, db, storage };