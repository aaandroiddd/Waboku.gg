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
  Firestore,
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database, ref, onValue, connectDatabaseEmulator } from 'firebase/database';

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

    // Initialize Firebase app
    let firebaseApp: FirebaseApp;
    
    // Check if Firebase is already initialized
    if (!getApps().length) {
      console.log('Initializing new Firebase app...');
      firebaseApp = initializeApp(firebaseConfig);
      console.log('Firebase app initialized successfully');
    } else {
      console.log('Firebase app already initialized, reusing existing app');
      firebaseApp = getApps()[0];
    }

    // Initialize services with better error handling
    let firebaseAuth: Auth;
    let firebaseDb: Firestore;
    let firebaseDatabase: Database;
    let firebaseStorage: FirebaseStorage | null = null;
    
    try {
      console.log('Initializing Firebase Auth...');
      firebaseAuth = getAuth(firebaseApp);
      console.log('Firebase Auth initialized successfully');
    } catch (authError) {
      console.error('Failed to initialize Firebase Auth:', authError);
      throw new Error('Authentication service initialization failed');
    }

    try {
      console.log('Initializing Firestore...');
      firebaseDb = getFirestore(firebaseApp);
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
      firebaseDatabase = getDatabase(firebaseApp);
      
      // Verify database connection
      console.log('Realtime Database initialized successfully');
      
      // Add a test connection to verify database is working
      if (typeof window !== 'undefined') {
        try {
          const testRef = ref(firebaseDatabase, '.info/connected');
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
        firebaseStorage = getStorage(firebaseApp);
        console.log('Firebase Storage initialized successfully');
      } catch (storageError) {
        console.error('Failed to initialize Firebase Storage:', storageError);
        // Non-critical, continue without storage
      }
    }

    // Set persistence only in browser environment
    if (typeof window !== 'undefined') {
      setPersistence(firebaseAuth, browserLocalPersistence)
        .then(() => {
          console.log('Firebase Auth persistence set to LOCAL');
        })
        .catch(error => {
          console.error('Error setting auth persistence:', error);
          // Non-critical, continue without persistence
        });
    }

    return { 
      app: firebaseApp, 
      auth: firebaseAuth, 
      db: firebaseDb, 
      storage: firebaseStorage, 
      database: firebaseDatabase 
    };
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
      app: null, 
      auth: null, 
      db: null, 
      storage: null, 
      database: null,
      initializationError: error
    };
  }
}

// Initialize Firebase on module load
const services = initializeFirebase();

// Export initialized services
export const app = services.app;
export const auth = services.auth;
export const db = services.db;
export const storage = services.storage;
export const database = services.database;

// Aliases for backward compatibility
export const firebaseApp = app;
export const firebaseAuth = auth;
export const firebaseDb = db;
export const firebaseStorage = storage;
export const firebaseDatabase = database;

// Helper function to get Firebase services
export function getFirebaseServices() {
  if (!app || !auth || !db) {
    throw new Error('Firebase services not initialized');
  }
  return services;
}

// Connection manager for Firestore and Realtime Database
class FirebaseConnectionManager {
  private isOnline: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 5000; // 5 seconds
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      
      // Initial connection check
      this.isOnline = navigator.onLine;
      
      // Setup connection monitoring for Realtime Database
      if (database) {
        try {
          const connectedRef = ref(database, '.info/connected');
          onValue(connectedRef, (snapshot) => {
            const connected = snapshot.val();
            console.log(`[Firebase] Realtime Database connection: ${connected ? 'connected' : 'disconnected'}`);
            
            if (!connected && this.isOnline) {
              // We're online but database is disconnected
              this.handleConnectionError();
            }
          });
        } catch (error) {
          console.error('[Firebase] Error setting up connection monitoring:', error);
        }
      }
    }
  }

  private handleOnline = () => {
    console.log('[Firebase] Browser went online');
    this.isOnline = true;
    this.reconnectFirebase();
  }

  private handleOffline = () => {
    console.log('[Firebase] Browser went offline');
    this.isOnline = false;
    
    // Disable Firestore network to prevent unnecessary retries
    if (db) {
      try {
        disableNetwork(db).then(() => {
          console.log('[Firebase] Firestore network disabled due to offline status');
        }).catch(error => {
          console.error('[Firebase] Error disabling Firestore network:', error);
        });
      } catch (error) {
        console.error('[Firebase] Error disabling Firestore network:', error);
      }
    }
  }

  private handleConnectionError = () => {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[Firebase] Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    this.reconnectAttempts++;
    
    // Clear any existing timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    // Exponential backoff for reconnect attempts
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 60000);
    console.log(`[Firebase] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectFirebase();
    }, delay);
  }

  private reconnectFirebase = () => {
    if (!this.isOnline) {
      console.log('[Firebase] Cannot reconnect while offline');
      return;
    }

    console.log('[Firebase] Attempting to reconnect Firebase services...');
    
    // Re-enable Firestore network
    if (db) {
      try {
        enableNetwork(db).then(() => {
          console.log('[Firebase] Firestore network re-enabled');
          this.reconnectAttempts = 0; // Reset counter on successful reconnect
          this.notifyListeners();
        }).catch(error => {
          console.error('[Firebase] Error re-enabling Firestore network:', error);
          this.handleConnectionError(); // Try again
        });
      } catch (error) {
        console.error('[Firebase] Error re-enabling Firestore network:', error);
        this.handleConnectionError(); // Try again
      }
    }
  }

  public addConnectionListener(listener: () => void): () => void {
    this.listeners.add(listener);
    
    // Return a function to remove the listener
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('[Firebase] Error in connection listener:', error);
      }
    });
  }

  public cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    this.listeners.clear();
  }
}

// Create and export the connection manager
export const connectionManager = typeof window !== 'undefined' ? new FirebaseConnectionManager() : null;