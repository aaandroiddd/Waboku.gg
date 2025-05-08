import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence, 
  Auth 
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore,
  enableIndexedDbPersistence,
  disableNetwork as disableFirestoreNetwork,
  enableNetwork as enableFirestoreNetwork,
  onSnapshot,
  Unsubscribe,
  DocumentReference,
  CollectionReference,
  Query
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database, ref, onValue } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Singleton instances
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseDatabase: Database | null = null;

// Listener registry
interface ListenerEntry {
  id: string;
  unsubscribe: Unsubscribe;
  timestamp: number;
  path: string;
}

const activeListeners: Map<string, ListenerEntry> = new Map();

/**
 * Initialize Firebase services
 * This function ensures Firebase is only initialized once
 */
export function initializeFirebaseServices() {
  // Only initialize once
  if (firebaseApp) {
    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage,
      database: firebaseDatabase
    };
  }

  try {
    // Check if Firebase is already initialized
    if (!getApps().length) {
      console.log('[Firebase] Initializing new Firebase app');
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      console.log('[Firebase] Firebase app already initialized, reusing existing app');
      firebaseApp = getApps()[0];
    }

    // Initialize services
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    
    // Only initialize storage in browser environment
    if (typeof window !== 'undefined') {
      firebaseStorage = getStorage(firebaseApp);
    }

    // Initialize Realtime Database if URL is provided
    if (firebaseConfig.databaseURL) {
      firebaseDatabase = getDatabase(firebaseApp);
      
      // Test database connection
      if (typeof window !== 'undefined') {
        const testRef = ref(firebaseDatabase, '.info/serverTimeOffset');
        onValue(testRef, () => {
          console.log('[Firebase] Realtime Database connection verified');
        }, { onlyOnce: true });
      }
    }

    // Set persistence only in browser environment
    if (typeof window !== 'undefined' && firebaseAuth) {
      setPersistence(firebaseAuth, browserLocalPersistence)
        .then(() => {
          console.log('[Firebase] Auth persistence set to LOCAL');
        })
        .catch(error => {
          console.error('[Firebase] Error setting auth persistence:', error);
        });
    }

    // Enable Firestore persistence for offline support
    if (typeof window !== 'undefined' && firebaseDb) {
      enableIndexedDbPersistence(firebaseDb)
        .then(() => {
          console.log('[Firebase] Firestore persistence enabled');
        })
        .catch((err) => {
          console.warn('[Firebase] Firestore persistence could not be enabled:', err.code);
        });
    }

    console.log('[Firebase] Services initialized successfully');
    
    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage,
      database: firebaseDatabase
    };
  } catch (error) {
    console.error('[Firebase] Error initializing Firebase:', error);
    throw error;
  }
}

/**
 * Get Firebase services
 * Initializes Firebase if not already initialized
 */
export function getFirebaseServices() {
  if (!firebaseApp || !firebaseDb) {
    return initializeFirebaseServices();
  }
  
  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firebaseDb,
    storage: firebaseStorage,
    database: firebaseDatabase
  };
}

/**
 * Register a Firestore listener with automatic cleanup
 */
export function registerListener<T>(
  id: string,
  ref: DocumentReference<T> | CollectionReference<T> | Query<T>,
  callback: (data: any) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe {
  // Remove existing listener with the same ID if it exists
  if (activeListeners.has(id)) {
    console.log(`[Firebase] Removing existing listener with ID: ${id}`);
    removeListener(id);
  }

  // Create new listener
  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error(`[Firebase] Error in listener callback (${id}):`, error);
        if (errorCallback) errorCallback(error as Error);
      }
    },
    (error) => {
      console.error(`[Firebase] Error in Firestore listener (${id}):`, error);
      if (errorCallback) errorCallback(error);
    }
  );

  // Store listener in registry
  const path = ref.path || (ref as any)._query?.path || "unknown-path";
  activeListeners.set(id, {
    id,
    unsubscribe,
    timestamp: Date.now(),
    path
  });

  console.log(`[Firebase] Registered Firestore listener: ${id} for path: ${path}`);
  console.log(`[Firebase] Active listeners count: ${activeListeners.size}`);
  
  return unsubscribe;
}

/**
 * Remove a specific listener by ID
 */
export function removeListener(id: string): boolean {
  const listener = activeListeners.get(id);
  if (listener) {
    try {
      listener.unsubscribe();
      activeListeners.delete(id);
      console.log(`[Firebase] Removed Firestore listener: ${id}`);
      return true;
    } catch (error) {
      console.error(`[Firebase] Error removing listener ${id}:`, error);
      // Still remove from registry even if unsubscribe fails
      activeListeners.delete(id);
      return false;
    }
  }
  return false;
}

/**
 * Remove all listeners for a specific prefix
 */
export function removeListenersByPrefix(prefix: string): number {
  let count = 0;
  
  for (const [id, listener] of activeListeners.entries()) {
    if (id.startsWith(prefix)) {
      try {
        listener.unsubscribe();
        activeListeners.delete(id);
        count++;
      } catch (error) {
        console.error(`[Firebase] Error removing listener ${id}:`, error);
        activeListeners.delete(id);
      }
    }
  }
  
  if (count > 0) {
    console.log(`[Firebase] Removed ${count} listeners with prefix: ${prefix}`);
  }
  
  return count;
}

/**
 * Remove all active listeners
 */
export function removeAllListeners(): number {
  let count = 0;
  
  for (const [id, listener] of activeListeners.entries()) {
    try {
      listener.unsubscribe();
      count++;
    } catch (error) {
      console.error(`[Firebase] Error removing listener ${id}:`, error);
    }
  }
  
  activeListeners.clear();
  console.log(`[Firebase] Removed all ${count} Firestore listeners`);
  
  return count;
}

/**
 * Get the count of active listeners
 */
export function getActiveListenersCount(): number {
  return activeListeners.size;
}

/**
 * Clean up old listeners that might have been forgotten
 */
export function cleanupStaleListeners(maxAgeMs: number = 3600000): number {
  const now = Date.now();
  let count = 0;
  
  for (const [id, listener] of activeListeners.entries()) {
    if (now - listener.timestamp > maxAgeMs) {
      try {
        listener.unsubscribe();
        activeListeners.delete(id);
        count++;
      } catch (error) {
        console.error(`[Firebase] Error removing stale listener ${id}:`, error);
        activeListeners.delete(id);
      }
    }
  }
  
  if (count > 0) {
    console.log(`[Firebase] Cleaned up ${count} stale listeners`);
  }
  
  return count;
}

/**
 * Network control functions
 */
export const disableNetwork = async () => {
  if (firebaseDb) {
    try {
      await disableFirestoreNetwork(firebaseDb);
      console.log('[Firebase] Firestore network disabled');
      return true;
    } catch (error) {
      console.error('[Firebase] Error disabling Firestore network:', error);
      return false;
    }
  }
  return false;
};

export const enableNetwork = async () => {
  if (firebaseDb) {
    try {
      await enableFirestoreNetwork(firebaseDb);
      console.log('[Firebase] Firestore network enabled');
      return true;
    } catch (error) {
      console.error('[Firebase] Error enabling Firestore network:', error);
      return false;
    }
  }
  return false;
};

// Automatically clean up stale listeners every hour if in browser environment
if (typeof window !== 'undefined') {
  setInterval(() => {
    cleanupStaleListeners();
  }, 3600000); // 1 hour
}

// Export Firebase instances
export const getApp = () => firebaseApp;
export const getDb = () => firebaseDb;
export const getAuth = () => firebaseAuth;
export const getStorage = () => firebaseStorage;
export const getDatabase = () => firebaseDatabase;