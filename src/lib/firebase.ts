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

// Initialize Firebase services
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let database: Database;

function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    // Initialize services
    auth = getAuth(app);
    db = getFirestore(app);
    database = getDatabase(app);

    // Only initialize storage in browser environment
    if (typeof window !== 'undefined') {
      storage = getStorage(app);
    }

    // Set persistence only in browser environment
    if (typeof window !== 'undefined') {
      setPersistence(auth, browserLocalPersistence)
        .catch(error => {
          console.error('Error setting auth persistence:', error);
        });
    }

    return { app, auth, db, storage, database };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

// Initialize Firebase on module load
const services = initializeFirebase();

// Export initialized services
export const { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, storage: firebaseStorage, database: firebaseDatabase } = services;

// Helper function to get Firebase services
export function getFirebaseServices() {
  if (!firebaseApp || !firebaseAuth || !firebaseDb) {
    throw new Error('Firebase services not initialized');
  }
  return services;
}