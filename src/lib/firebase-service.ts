import { FirebaseApp } from 'firebase/app';
import {
  Auth
} from 'firebase/auth';
import {
  Firestore,
  onSnapshot,
  Unsubscribe,
  DocumentReference,
  CollectionReference,
  Query
} from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { Database } from 'firebase/database';

// Import from the consolidated firebase.ts file
import { 
  getFirebaseServices as getFirebaseServicesFromBase,
  disableNetwork as disableFirestoreNetwork,
  enableNetwork as enableFirestoreNetwork
} from './firebase';

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
 * This function ensures Firebase is only initialized once by delegating to the base implementation
 */
export function initializeFirebaseServices() {
  return getFirebaseServicesFromBase();
}

/**
 * Get Firebase services
 * Initializes Firebase if not already initialized
 */
export function getFirebaseServices() {
  return getFirebaseServicesFromBase();
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
  const { db } = getFirebaseServices();
  if (db) {
    try {
      await disableFirestoreNetwork(db);
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
  const { db } = getFirebaseServices();
  if (db) {
    try {
      await enableFirestoreNetwork(db);
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

// Export Firebase instances through the getFirebaseServices function
export const getApp = () => {
  const { app } = getFirebaseServices();
  return app;
};

export const getDb = () => {
  const { db } = getFirebaseServices();
  return db;
};

export const getAuth = () => {
  const { auth } = getFirebaseServices();
  return auth;
};

export const getFirebaseStorage = () => {
  const { storage } = getFirebaseServices();
  return storage;
};

export const getFirebaseDatabase = () => {
  const { database } = getFirebaseServices();
  return database;
};