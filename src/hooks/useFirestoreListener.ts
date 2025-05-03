/**
 * Custom hook for managing Firestore listeners with a registry system
 * This hook provides a way to register and track Firestore listeners by ID
 */

import { useEffect, useRef } from 'react';
import { DocumentReference, CollectionReference, Query } from 'firebase/firestore';
import { 
  registerListener, 
  removeListener, 
  removeListenersByPrefix, 
  getActiveListenersCount as getListenersCount, 
  getActiveListeners 
} from '../lib/firebaseConnectionManager';

/**
 * Hook to create and manage a Firestore listener with a specific ID
 * 
 * @param id Unique identifier for this listener
 * @param ref Firestore reference (document, collection, or query)
 * @param callback Function to call when data changes
 * @param dependencies Array of dependencies to control when the listener is recreated
 * @returns void
 */
export function useFirestoreListener<T>(
  id: string,
  ref: DocumentReference<T> | CollectionReference<T> | Query<T> | null,
  callback: (data: any) => void,
  dependencies: any[] = []
): void {
  // Store the callback in a ref to avoid recreating the listener when only the callback changes
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Skip if no reference is provided
    if (!ref) return;

    // Create new listener using the centralized registry
    console.log(`Creating new Firestore listener with ID: ${id}`);
    const unsubscribe = registerListener(id, ref, (snapshot) => {
      callbackRef.current(snapshot);
    });

    // Cleanup function
    return () => {
      console.log(`Unmounting and cleaning up listener with ID: ${id}`);
      removeListener(id);
    };
  }, [id, ref, ...dependencies]);
}

/**
 * Manually remove a specific listener by ID
 * 
 * @param id The ID of the listener to remove
 * @returns boolean indicating if a listener was found and removed
 */
export function removeFirestoreListener(id: string): boolean {
  return removeListener(id);
}

/**
 * Remove all listeners with a specific prefix
 * 
 * @param prefix The prefix to match against listener IDs
 * @returns number of listeners removed
 */
export function removeFirestoreListenersByPrefix(prefix: string): number {
  return removeListenersByPrefix(prefix);
}

/**
 * Get the count of active listeners
 */
export function getActiveListenersCount(): number {
  return getListenersCount();
}

/**
 * Get all active listener information for debugging
 */
export function getActiveListenerInfo(): Array<{ id: string; path: string; timestamp: number }> {
  return getActiveListeners();
}