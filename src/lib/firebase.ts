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

// Validate required Firebase configuration
const requiredConfig = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

const missingConfig = requiredConfig.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingConfig.length > 0) {
  console.error('Missing required Firebase configuration:', missingConfig);
  throw new Error(`Missing required Firebase configuration: ${missingConfig.join(', ')}`);
}

let firebaseApp: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let database: any;

export const getFirebaseServices = () => {
  try {
    if (!firebaseApp) {
      // Initialize Firebase only once
      if (!getApps().length) {
        console.log('Initializing new Firebase app...');
        firebaseApp = initializeApp(firebaseConfig);
      } else {
        console.log('Using existing Firebase app...');
        firebaseApp = getApps()[0];
      }

      // Initialize services
      auth = getAuth(firebaseApp);
      db = getFirestore(firebaseApp);
      storage = getStorage(firebaseApp);

      // Initialize Realtime Database if URL is provided
      if (firebaseConfig.databaseURL) {
        console.log('Initializing Realtime Database...');
        try {
          const { getDatabase } = require('firebase/database');
          database = getDatabase(firebaseApp);
          console.log('Realtime Database initialized successfully');
        } catch (error) {
          console.error('Error initializing Realtime Database:', error);
        }
      }

      // Set persistence for browser environment
      if (typeof window !== 'undefined') {
        setPersistence(auth, browserLocalPersistence)
          .catch(error => console.error('Error setting auth persistence:', error));
      }
    }

    return { app: firebaseApp, auth, db, storage, database };
  } catch (error) {
    console.error('Error initializing Firebase services:', error);
    throw error;
  }
};

// Export initialized services
export { firebaseApp as app, auth, db, storage };