import { useEffect } from 'react';
import { registerGlobalListener, cleanupListener } from './useFirestoreListenerCleanup';

// Map to track active listeners by ID
const activeListenerMap: Map<string, () => void> = new Map();

/**
 * Register a Firestore listener with a specific ID for easier cleanup
 * @param id Unique identifier for this listener
 * @param unsubscribe Function to call to unsubscribe the listener
 * @returns Function to manually unregister the listener
 */
export const registerListener = (id: string, unsubscribe: () => void): () => void => {
  // If there's already a listener with this ID, clean it up first
  if (activeListenerMap.has(id)) {
    console.log(`[FirestoreListener] Replacing existing listener for ${id}`);
    const existingUnsubscribe = activeListenerMap.get(id);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }
  }
  
  // Register the new listener
  activeListenerMap.set(id, unsubscribe);
  console.log(`[FirestoreListener] Registered listener ${id}. Total active: ${activeListenerMap.size}`);
  
  // Also register with the global system
  registerGlobalListener(id, unsubscribe);
  
  // Return a function to unregister this listener
  return () => {
    if (activeListenerMap.has(id)) {
      console.log(`[FirestoreListener] Unregistering listener ${id}`);
      const listenerUnsubscribe = activeListenerMap.get(id);
      if (listenerUnsubscribe) {
        listenerUnsubscribe();
      }
      activeListenerMap.delete(id);
      
      // Also clean up from the global registry
      cleanupListener(id);
    }
  };
};

/**
 * Hook to manage a Firestore listener with automatic cleanup
 * @param id Unique identifier for this listener
 * @param createListener Function that creates and returns the listener unsubscribe function
 */
export const useFirestoreListener = (
  id: string,
  createListener: () => (() => void) | undefined
) => {
  useEffect(() => {
    // Create the listener
    const unsubscribe = createListener();
    
    // If the listener was created successfully, register it
    if (unsubscribe) {
      registerListener(id, unsubscribe);
    }
    
    // Clean up when the component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      
      // Also clean up from our registry
      if (activeListenerMap.has(id)) {
        activeListenerMap.delete(id);
      }
      
      // And from the global registry
      cleanupListener(id);
    };
  }, [id]);
};

/**
 * Get the count of active listeners
 */
export const getActiveListenerCount = (): number => {
  return activeListenerMap.size;
};

/**
 * Clean up all listeners
 */
export const cleanupAllListeners = (): void => {
  console.log(`[FirestoreListener] Cleaning up all ${activeListenerMap.size} listeners`);
  
  activeListenerMap.forEach((unsubscribe, id) => {
    try {
      unsubscribe();
    } catch (error) {
      console.error(`[FirestoreListener] Error cleaning up listener ${id}:`, error);
    }
  });
  
  activeListenerMap.clear();
};