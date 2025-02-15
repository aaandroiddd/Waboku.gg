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
import { getDatabase, Database } from 'firebase/database';

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
  'appId',
  'databaseURL'
];

const missingConfig = requiredConfig.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingConfig.length > 0) {
  console.error('Missing required Firebase configuration:', missingConfig);
  throw new Error(`Missing required Firebase configuration: ${missingConfig.join(', ')}`);
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let database: Database;

if (typeof window !== 'undefined') {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    database = getDatabase(app);

    // Set persistence for browser environment
    setPersistence(auth, browserLocalPersistence)
      .catch(error => console.error('Error setting auth persistence:', error));
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
} else {
  // Server-side initialization
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  database = getDatabase(app);
}

export { app, auth, db, storage, database };

// Helper function to get Firebase services
export function getFirebaseServices() {
  if (!app || !auth || !db || !storage || !database) {
    throw new Error('Firebase services not initialized');
  }
  return { app, auth, db, storage, database };
}