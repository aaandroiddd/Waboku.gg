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
  disableNetwork as disableFirestoreNetwork,
  enableNetwork as enableFirestoreNetwork,
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
let services: ReturnType<typeof initializeFirebase>;

// Initialize Firebase services with retry mechanism
if (typeof window !== 'undefined') {
  const initializeWithRetry = async (maxRetries = 3, delay = 1500) => {
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Firebase] Initialization attempt ${attempt + 1}/${maxRetries}`);
        const initializedServices = initializeFirebase();
        
        // Verify that critical services are available
        if (initializedServices.app && initializedServices.db) {
          console.log('[Firebase] Services initialized successfully on attempt', attempt + 1);
          return initializedServices;
        } else {
          console.warn('[Firebase] Incomplete initialization, missing critical services');
          // Wait before retrying
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        lastError = error;
        console.error(`[Firebase] Initialization attempt ${attempt + 1} failed:`, error);
        
        // Wait before retrying
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`[Firebase] All ${maxRetries} initialization attempts failed`);
    return { 
      app: null, 
      auth: null, 
      db: null, 
      storage: null, 
      database: null,
      initializationError: lastError
    };
  };

  // Initialize immediately but with retry capability
  try {
    services = initializeFirebase();
    
    // If initial attempt failed or is incomplete, retry in the background
    if (!services.app || !services.db) {
      console.warn('[Firebase] Initial initialization incomplete, scheduling background retry');
      
      // Schedule a background retry that will update the services object
      setTimeout(async () => {
        try {
          const retryServices = await initializeWithRetry(3, 2000);
          
          // Update the services with retry results if better than what we have
          if (retryServices.app && retryServices.db && (!services.app || !services.db)) {
            console.log('[Firebase] Background retry succeeded, updating services');
            Object.assign(services, retryServices);
          }
        } catch (retryError) {
          console.error('[Firebase] Background retry failed:', retryError);
        }
      }, 1000);
    } else {
      console.log('[Firebase] Services initialized successfully on first attempt');
    }
  } catch (error) {
    console.error('[Firebase] Initial initialization failed:', error);
    services = { 
      app: null, 
      auth: null, 
      db: null, 
      storage: null, 
      database: null,
      initializationError: error
    };
    
    // Schedule a background retry
    setTimeout(async () => {
      try {
        const retryServices = await initializeWithRetry(3, 2000);
        Object.assign(services, retryServices);
      } catch (retryError) {
        console.error('[Firebase] Background retry failed:', retryError);
      }
    }, 1000);
  }
} else {
  // Server-side initialization with empty services
  services = { 
    app: null, 
    auth: null, 
    db: null, 
    storage: null, 
    database: null
  };
}

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

// Helper function to get Firebase services with better error handling
export function getFirebaseServices() {
  // Check if services are initialized
  if (app && auth && db) {
    return services;
  }
  
  // If we're in the browser, try to reinitialize
  if (typeof window !== 'undefined') {
    console.warn('[Firebase] Services not fully initialized when requested, attempting to reinitialize');
    
    try {
      // Try to initialize again
      const reinitialized = initializeFirebase();
      
      // If we got valid services, update the global services object
      if (reinitialized.app && reinitialized.auth && reinitialized.db) {
        console.log('[Firebase] Reinitialization successful');
        Object.assign(services, reinitialized);
        return services;
      } else {
        console.error('[Firebase] Reinitialization failed to produce valid services');
      }
    } catch (error) {
      console.error('[Firebase] Error during reinitialization:', error);
    }
  }
  
  // Return the services even if incomplete - the calling code should handle null values
  console.warn('[Firebase] Returning potentially incomplete services');
  return services;
}

// Connection manager for Firestore and Realtime Database
class FirebaseConnectionManager {
  private isOnline: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 5000; // 5 seconds
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private connectionCheckIntervalId: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();
  private lastReconnectTime: number = 0;
  private isReconnecting: boolean = false;
  private connectionErrors: Set<string> = new Set();
  private consecutiveErrors: number = 0;
  private reconnectInProgress: boolean = false;

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
            
            if (connected) {
              // Reset error counters on successful connection
              this.resetErrorState();
              this.notifyListeners();
            } else if (this.isOnline) {
              // We're online but database is disconnected
              this.handleConnectionError('Database disconnected while browser is online');
            }
          });
        } catch (error) {
          console.error('[Firebase] Error setting up connection monitoring:', error);
        }
      }
      
      // Set up periodic connection check
      this.connectionCheckIntervalId = setInterval(() => {
        this.checkConnection();
      }, 30000); // Check every 30 seconds
    }
  }

  private resetErrorState() {
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    this.connectionErrors.clear();
  }

  private checkConnection = () => {
    // Skip check if we're offline or already reconnecting
    if (!this.isOnline || this.isReconnecting) return;
    
    // If we have database, check connection status
    if (database) {
      try {
        const connectedRef = ref(database, '.info/connected');
        onValue(connectedRef, (snapshot) => {
          const connected = snapshot.val();
          
          // Only log if disconnected to reduce noise
          if (!connected) {
            console.log('[Firebase] Periodic check: Database disconnected while browser is online');
            this.handleConnectionError('Periodic check failed');
          }
        }, { onlyOnce: true });
      } catch (error) {
        console.error('[Firebase] Error during periodic connection check:', error);
      }
    }
  }

  private handleOnline = () => {
    console.log('[Firebase] Browser went online');
    this.isOnline = true;
    
    // Reset consecutive errors when coming back online
    this.consecutiveErrors = 0;
    
    // Attempt reconnection with a small delay to allow network to stabilize
    setTimeout(() => {
      this.reconnectFirebase();
    }, 1000);
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

  private handleConnectionError = (reason: string) => {
    // Track unique error reasons
    this.connectionErrors.add(reason);
    this.consecutiveErrors++;
    
    console.log(`[Firebase] Connection error (${this.consecutiveErrors}): ${reason}`);
    
    // Limit reconnection attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[Firebase] Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
      
      // Reset after a longer period to allow future attempts
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
      }
      
      this.reconnectTimeoutId = setTimeout(() => {
        console.log('[Firebase] Resetting reconnect attempts counter after cooling period');
        this.reconnectAttempts = 0;
        this.reconnectFirebase();
      }, 120000); // 2 minutes cooling period
      
      return;
    }

    // Don't attempt reconnection too frequently
    const now = Date.now();
    const timeSinceLastReconnect = now - this.lastReconnectTime;
    
    if (timeSinceLastReconnect < 5000) {
      console.log('[Firebase] Skipping reconnect attempt - too soon since last attempt');
      return;
    }

    this.reconnectAttempts++;
    
    // Clear any existing timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    
    // Exponential backoff for reconnect attempts with jitter
    const baseDelay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(baseDelay + jitter, 60000);
    
    console.log(`[Firebase] Scheduling reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectFirebase();
    }, delay);
  }

  private reconnectFirebase = async () => {
    if (!this.isOnline) {
      console.log('[Firebase] Cannot reconnect while offline');
      return;
    }

    if (this.reconnectInProgress) {
      console.log('[Firebase] Reconnection already in progress, skipping');
      return;
    }

    this.reconnectInProgress = true;
    this.isReconnecting = true;
    this.lastReconnectTime = Date.now();
    
    console.log('[Firebase] Attempting to reconnect Firebase services...');
    
    try {
      // First disable the network to reset any hanging connections
      if (db) {
        try {
          await disableNetwork(db);
          console.log('[Firebase] Firestore network disabled for reconnection');
          
          // Short delay to ensure disconnection is complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Then re-enable the network
          await enableNetwork(db);
          console.log('[Firebase] Firestore network re-enabled');
          
          // Reset error counters on successful reconnect
          this.resetErrorState();
          this.notifyListeners();
        } catch (error) {
          console.error('[Firebase] Error during Firestore reconnection:', error);
          // Don't throw here, just log the error
        }
      }
    } catch (error) {
      console.error('[Firebase] Error during reconnection process:', error);
      // Schedule another attempt if this one failed
      this.handleConnectionError('Reconnection attempt failed');
    } finally {
      // Allow new reconnection attempts after a delay
      setTimeout(() => {
        this.isReconnecting = false;
        this.reconnectInProgress = false;
      }, 5000);
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
    
    if (this.connectionCheckIntervalId) {
      clearInterval(this.connectionCheckIntervalId);
    }
    
    this.listeners.clear();
  }
}

// Create and export the connection manager
export const connectionManager = typeof window !== 'undefined' ? new FirebaseConnectionManager() : null;

// Export network control functions
export const disableNetwork = (firestore: Firestore) => disableFirestoreNetwork(firestore);
export const enableNetwork = (firestore: Firestore) => enableFirestoreNetwork(firestore);