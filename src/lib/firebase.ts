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
import { getDatabase, Database, ref, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Log the config for debugging (without exposing full API key)
console.log('Firebase config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
    `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5)}...` : 'missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'missing'
});

// Validate Firebase API key
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.error('Firebase API key is missing in environment variables');
}

// Initialize Firebase services
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let database: Database;

function initializeFirebase() {
  try {
    // Validate Firebase config with detailed logging
    console.log('Validating Firebase configuration...');
    
    // Check for required config values
    const missingConfigValues = Object.entries(firebaseConfig)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingConfigValues.length > 0) {
      console.error('Firebase configuration is incomplete. Missing values for:', missingConfigValues);
      
      // Log specific missing values that are critical
      if (!firebaseConfig.apiKey) console.error('CRITICAL: Firebase API key is missing');
      if (!firebaseConfig.projectId) console.error('CRITICAL: Firebase project ID is missing');
      if (!firebaseConfig.databaseURL) console.error('CRITICAL: Firebase database URL is missing - Realtime Database will not work');
      
      throw new Error('Firebase configuration is incomplete. Check your environment variables.');
    }
    
    console.log('Firebase configuration validated successfully');

    // Check if Firebase is already initialized
    if (!getApps().length) {
      console.log('Initializing new Firebase app...');
      app = initializeApp(firebaseConfig);
      console.log('Firebase app initialized successfully');
    } else {
      console.log('Firebase app already initialized, reusing existing app');
      app = getApps()[0];
    }

    // Initialize services with better error handling
    try {
      console.log('Initializing Firebase Auth...');
      auth = getAuth(app);
      console.log('Firebase Auth initialized successfully');
    } catch (authError) {
      console.error('Failed to initialize Firebase Auth:', authError);
      throw new Error('Authentication service initialization failed');
    }

    try {
      console.log('Initializing Firestore...');
      db = getFirestore(app);
      console.log('Firestore initialized successfully');
    } catch (dbError) {
      console.error('Failed to initialize Firestore:', dbError);
      throw new Error('Database service initialization failed');
    }

    try {
      console.log('Initializing Realtime Database with URL:', 
        firebaseConfig.databaseURL ? 
        `${firebaseConfig.databaseURL.substring(0, 8)}...` : 'missing');
      
      if (!firebaseConfig.databaseURL) {
        console.error('CRITICAL: Firebase database URL is missing. Realtime Database will not work properly.');
        throw new Error('Firebase Realtime Database URL is missing. Check your environment variables.');
      }
      
      // Explicitly pass the databaseURL to ensure it's properly configured
      database = getDatabase(app);
      
      // Verify database connection
      console.log('Realtime Database initialized successfully');
      
      // Add a test connection to verify database is working
      if (typeof window !== 'undefined') {
        try {
          const testRef = ref(database, '.info/connected');
          onValue(testRef, (snapshot) => {
            const connected = snapshot.val();
            console.log('Realtime Database connection status:', connected ? 'connected' : 'disconnected');
          });
        } catch (connError) {
          console.error('Error testing database connection:', connError);
        }
      }
      
      // Verify database URL is correctly formatted
      if (firebaseConfig.databaseURL && !firebaseConfig.databaseURL.startsWith('https://')) {
        console.error('CRITICAL: Firebase database URL is incorrectly formatted. It should start with https://');
      }
    } catch (rtdbError) {
      console.error('Failed to initialize Realtime Database:', rtdbError);
      console.error('Realtime Database error details:', {
        message: rtdbError instanceof Error ? rtdbError.message : 'Unknown error',
        name: rtdbError instanceof Error ? rtdbError.name : 'Unknown error type',
        stack: rtdbError instanceof Error ? rtdbError.stack : 'No stack trace'
      });
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