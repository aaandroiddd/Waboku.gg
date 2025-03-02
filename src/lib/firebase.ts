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
    // Validate Firebase config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error('Firebase configuration is incomplete:', 
        Object.keys(firebaseConfig).filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]));
      throw new Error('Firebase configuration is incomplete. Check your environment variables.');
    }

    // Check if Firebase is already initialized
    if (!getApps().length) {
      console.log('Initializing Firebase app...');
      app = initializeApp(firebaseConfig);
    } else {
      console.log('Firebase app already initialized, reusing existing app');
      app = getApps()[0];
    }

    // Initialize services with better error handling
    try {
      auth = getAuth(app);
      console.log('Firebase Auth initialized successfully');
    } catch (authError) {
      console.error('Failed to initialize Firebase Auth:', authError);
      throw new Error('Authentication service initialization failed');
    }

    try {
      db = getFirestore(app);
      console.log('Firestore initialized successfully');
    } catch (dbError) {
      console.error('Failed to initialize Firestore:', dbError);
      throw new Error('Database service initialization failed');
    }

    try {
      database = getDatabase(app);
      console.log('Realtime Database initialized successfully');
    } catch (rtdbError) {
      console.error('Failed to initialize Realtime Database:', rtdbError);
      throw new Error('Realtime Database service initialization failed');
    }

    // Only initialize storage in browser environment
    if (typeof window !== 'undefined') {
      try {
        storage = getStorage(app);
        console.log('Firebase Storage initialized successfully');
      } catch (storageError) {
        console.error('Failed to initialize Firebase Storage:', storageError);
        // Non-critical, continue without storage
      }
    }

    // Set persistence only in browser environment
    if (typeof window !== 'undefined') {
      setPersistence(auth, browserLocalPersistence)
        .then(() => {
          console.log('Firebase Auth persistence set to LOCAL');
        })
        .catch(error => {
          console.error('Error setting auth persistence:', error);
          // Non-critical, continue without persistence
        });
    }

    return { app, auth, db, storage, database };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    
    // Provide more helpful error messages based on the error
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        console.error('Firebase API key is invalid or missing');
      } else if (error.message.includes('project')) {
        console.error('Firebase project ID is invalid or missing');
      } else if (error.message.includes('network')) {
        console.error('Network error while initializing Firebase - check your internet connection');
      }
    }
    
    // Return a partially initialized object to prevent complete app failure
    // This allows the app to at least render something instead of crashing completely
    return { 
      app: app || null, 
      auth: auth || null, 
      db: db || null, 
      storage: storage || null, 
      database: database || null,
      initializationError: error
    };
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