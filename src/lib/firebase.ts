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
  onSnapshot,
  Unsubscribe,
  DocumentReference,
  CollectionReference,
  Query
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';

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
let isInitialized = false;

// Log the config for debugging (without exposing full API key)
console.log('[Firebase] Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
    `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5)}...` : 'missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'missing'
});

/**
 * Initialize Firebase services
 * This function ensures Firebase is only initialized once
 */
function initializeFirebase() {
  // If already initialized, return the existing instances
  if (isInitialized && firebaseApp && firebaseDb) {
    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage,
      database: firebaseDatabase
    };
  }
  
  try {
    // Validate Firebase config
    console.log('[Firebase] Validating configuration...');
    
    // Check for required config values
    const missingConfigValues = Object.entries(firebaseConfig)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingConfigValues.length > 0) {
      console.error('[Firebase] Configuration is incomplete. Missing values for:', missingConfigValues);
      throw new Error('Firebase configuration is incomplete. Check your environment variables.');
    }
    
    console.log('[Firebase] Configuration validated successfully');

    // Initialize Firebase app
    if (!getApps().length) {
      console.log('[Firebase] Initializing new Firebase app');
      firebaseApp = initializeApp(firebaseConfig);
      console.log('[Firebase] App initialized successfully');
    } else {
      console.log('[Firebase] App already initialized, reusing existing app');
      firebaseApp = getApps()[0];
    }

    // Initialize services
    console.log('[Firebase] Initializing services...');
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    firebaseDatabase = getDatabase(firebaseApp);
    
    // Only initialize storage in browser environment
    if (typeof window !== 'undefined') {
      firebaseStorage = getStorage(firebaseApp);
    }

    // Set persistence only in browser environment
    if (typeof window !== 'undefined' && firebaseAuth) {
      setPersistence(firebaseAuth, browserLocalPersistence)
        .catch(error => {
          console.warn('[Firebase] Error setting auth persistence:', error);
        });
    }

    // Enable Firestore persistence for offline support
    if (typeof window !== 'undefined' && firebaseDb) {
      enableIndexedDbPersistence(firebaseDb)
        .catch((err) => {
          console.warn('[Firebase] Firestore persistence could not be enabled:', err.code);
        });
    }

    isInitialized = true;
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
  return initializeFirebase();
}

// Initialize Firebase on module load if in browser environment
if (typeof window !== 'undefined') {
  // Initialize Firebase immediately
  initializeFirebase();
}

 // Export network control functions (wrapped to use initialized Firestore)
export async function disableNetwork() {
  const { db } = getFirebaseServices();
  if (!db) {
    console.warn('[Firebase] disableNetwork called before Firestore init');
    return;
  }
  return disableFirestoreNetwork(db);
}

export async function enableNetwork() {
  const { db } = getFirebaseServices();
  if (!db) {
    console.warn('[Firebase] enableNetwork called before Firestore init');
    return;
  }
  return enableFirestoreNetwork(db);
}

// Listener registry
interface ListenerEntry {
  id: string;
  unsubscribe: Unsubscribe;
  timestamp: number;
  path: string;
}

const activeListeners: Map<string, ListenerEntry> = new Map();

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

  // Create new listener with basic error handling
  let unsubscribe: Unsubscribe;
  
  try {
    unsubscribe = onSnapshot(
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
  } catch (setupError) {
    console.error(`[Firebase] Error setting up listener (${id}):`, setupError);
    
    // Create a no-op unsubscribe function
    unsubscribe = () => {};
    
    // Notify error callback if provided
    if (errorCallback) errorCallback(setupError as Error);
    
    // Return early
    return unsubscribe;
  }

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

// Centralized connection manager export for backward compatibility
export const connectionManager = {
  getServices: getFirebaseServices,
  enableNetwork,
  disableNetwork,
  registerListener,
  removeListener,
  removeListenersByPrefix,
  removeAllListeners,
  getActiveListenersCount,
  cleanupStaleListeners,
  getActiveListeners: () => {
    return Array.from((activeListeners as Map<string, any>).values()).map((x: any) => ({
      id: x.id,
      path: x.path,
      timestamp: x.timestamp,
    }));
  },
};

// Automatically clean up stale listeners every hour if in browser environment
if (typeof window !== 'undefined') {
  setInterval(() => {
    cleanupStaleListeners();
  }, 3600000); // 1 hour
}

// Export individual services for direct access
export const { app, auth, db, storage, database } = (() => {
  if (typeof window !== 'undefined') {
    const services = getFirebaseServices();
    return services;
  }
  // Return empty objects for server-side rendering
  return { app: null, auth: null, db: null, storage: null, database: null };
})();