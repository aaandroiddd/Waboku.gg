/**
 * Firebase Connection Manager
 * 
 * This module provides centralized management of Firebase connections and listeners
 * to prevent excessive connections and ensure proper cleanup.
 * 
 * DEPRECATED: This file is kept for backward compatibility.
 * Please use src/lib/firebase.ts for all Firebase operations.
 */

import { 
  registerListener as registerListenerBase,
  removeListener as removeListenerBase,
  removeListenersByPrefix as removeListenersByPrefixBase,
  removeAllListeners as removeAllListenersBase,
  getActiveListenersCount as getActiveListenersCountBase,
  cleanupStaleListeners as cleanupStaleListenersBase,
  getFirebaseServices
} from '@/lib/firebase';

import { 
  DocumentReference, 
  CollectionReference, 
  Query,
  Unsubscribe
} from "firebase/firestore";

/**
 * Get Firestore instance (initializes Firebase if needed)
 * @deprecated Use getFirebaseServices().db instead
 */
export function getFirestoreInstance() {
  console.warn('[Firebase] getFirestoreInstance is deprecated. Use getFirebaseServices().db instead');
  const { db } = getFirebaseServices();
  return db;
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
  return registerListenerBase(id, ref, callback, errorCallback);
}

/**
 * Remove a specific listener by ID
 */
export function removeListener(id: string): boolean {
  return removeListenerBase(id);
}

/**
 * Remove all listeners for a specific prefix
 * Useful for cleaning up all listeners related to a specific feature or page
 */
export function removeListenersByPrefix(prefix: string): number {
  return removeListenersByPrefixBase(prefix);
}

/**
 * Remove all active listeners
 */
export function removeAllListeners(): number {
  return removeAllListenersBase();
}

/**
 * Get the count of active listeners
 */
export function getActiveListenersCount(): number {
  return getActiveListenersCountBase();
}

/**
 * Get all active listeners for debugging
 */
export function getActiveListeners(): Array<{ id: string; path: string; timestamp: number }> {
  // This is a stub - the actual implementation is in firebase.ts
  console.warn('[Firebase] getActiveListeners is deprecated and may not return accurate results');
  return [];
}

/**
 * Clean up old listeners that might have been forgotten
 * @param maxAgeMs Maximum age of listeners in milliseconds
 */
export function cleanupStaleListeners(maxAgeMs: number = 3600000): number {
  return cleanupStaleListenersBase(maxAgeMs);
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