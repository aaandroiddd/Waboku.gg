/**
 * Firebase Connection Manager
 * 
 * This module provides centralized management of Firebase connections and listeners
 * to prevent excessive connections and ensure proper cleanup.
 */

import { getApp, getApps, initializeApp } from "firebase/app";
import { 
  getFirestore, 
  Firestore, 
  onSnapshot, 
  Unsubscribe, 
  DocumentReference, 
  CollectionReference, 
  Query 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Singleton pattern for Firebase instances
let firestoreInstance: Firestore | null = null;
let isInitialized = false;

// Global registry of active listeners
interface ListenerEntry {
  id: string;
  unsubscribe: Unsubscribe;
  timestamp: number;
  path: string;
}

const activeListeners: Map<string, ListenerEntry> = new Map();

/**
 * Initialize Firebase if not already initialized
 */
export function initializeFirebase() {
  if (!isInitialized) {
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      firestoreInstance = getFirestore(app);
      isInitialized = true;
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      throw error;
    }
  }
  return { 
    firestore: firestoreInstance,
    auth: getAuth(),
    storage: getStorage()
  };
}

/**
 * Get Firestore instance (initializes Firebase if needed)
 */
export function getFirestoreInstance(): Firestore {
  if (!firestoreInstance) {
    const { firestore } = initializeFirebase();
    firestoreInstance = firestore;
  }
  return firestoreInstance;
}

/**
 * Register a Firestore listener with a unique ID
 * If a listener with the same ID already exists, it will be removed first
 */
export function registerListener<T>(
  id: string,
  ref: DocumentReference<T> | CollectionReference<T> | Query<T>,
  callback: (data: any) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe {
  // Remove existing listener with the same ID if it exists
  if (activeListeners.has(id)) {
    console.log(`Removing existing listener with ID: ${id}`);
    removeListener(id);
  }

  // Create new listener
  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error(`Error in listener callback (${id}):`, error);
        if (errorCallback) errorCallback(error as Error);
      }
    },
    (error) => {
      console.error(`Error in Firestore listener (${id}):`, error);
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

  console.log(`Registered Firestore listener: ${id} for path: ${path}`);
  console.log(`Active listeners count: ${activeListeners.size}`);
  
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
      console.log(`Removed Firestore listener: ${id}`);
      console.log(`Remaining listeners: ${activeListeners.size}`);
      return true;
    } catch (error) {
      console.error(`Error removing listener ${id}:`, error);
      // Still remove from registry even if unsubscribe fails
      activeListeners.delete(id);
      return false;
    }
  }
  return false;
}

/**
 * Remove all listeners for a specific prefix
 * Useful for cleaning up all listeners related to a specific feature or page
 */
export function removeListenersByPrefix(prefix: string): number {
  let count = 0;
  
  // Find all listeners with matching prefix
  for (const [id, listener] of activeListeners.entries()) {
    if (id.startsWith(prefix)) {
      try {
        listener.unsubscribe();
        activeListeners.delete(id);
        count++;
      } catch (error) {
        console.error(`Error removing listener ${id}:`, error);
        // Still remove from registry even if unsubscribe fails
        activeListeners.delete(id);
      }
    }
  }
  
  if (count > 0) {
    console.log(`Removed ${count} listeners with prefix: ${prefix}`);
    console.log(`Remaining listeners: ${activeListeners.size}`);
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
      console.error(`Error removing listener ${id}:`, error);
    }
  }
  
  activeListeners.clear();
  console.log(`Removed all ${count} Firestore listeners`);
  
  return count;
}

/**
 * Get the count of active listeners
 */
export function getActiveListenersCount(): number {
  return activeListeners.size;
}

/**
 * Get all active listeners for debugging
 */
export function getActiveListeners(): Array<{ id: string; path: string; timestamp: number }> {
  return Array.from(activeListeners.values()).map(({ id, path, timestamp }) => ({
    id,
    path,
    timestamp
  }));
}

/**
 * Clean up old listeners that might have been forgotten
 * @param maxAgeMs Maximum age of listeners in milliseconds
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
        console.error(`Error removing stale listener ${id}:`, error);
        // Still remove from registry even if unsubscribe fails
        activeListeners.delete(id);
      }
    }
  }
  
  if (count > 0) {
    console.log(`Cleaned up ${count} stale listeners`);
  }
  
  return count;
}

// Automatically clean up stale listeners every hour if in browser environment
if (typeof window !== 'undefined') {
  setInterval(() => {
    cleanupStaleListeners();
  }, 3600000); // 1 hour
}

// Export a hook-friendly version of the listener registration
export function createFirestoreListener<T>(
  id: string,
  ref: DocumentReference<T> | CollectionReference<T> | Query<T>,
  callback: (data: any) => void,
  errorCallback?: (error: Error) => void
): () => void {
  registerListener(id, ref, callback, errorCallback);
  
  // Return a function that can be used to unsubscribe
  return () => removeListener(id);
}