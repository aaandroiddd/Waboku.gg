import { useState, useEffect, useRef } from 'react';

// Global registry of active listeners
interface ListenerRegistry {
  [pageId: string]: {
    cleanup: () => void;
    timestamp: number;
  };
}

// Global registry to track all active listeners
const activeListeners: ListenerRegistry = {};

// Function to get the count of active listeners
export const getActiveListenerCount = (): number => {
  return Object.keys(activeListeners).length;
};

// Function to register a global listener that can be cleaned up later
export const registerGlobalListener = (
  pageId: string,
  cleanup: () => void
): void => {
  // If there's already a listener for this page, clean it up first
  if (activeListeners[pageId]) {
    console.log(`[FirestoreCleanup] Replacing existing listener for ${pageId}`);
    activeListeners[pageId].cleanup();
  }

  // Register the new listener
  activeListeners[pageId] = {
    cleanup,
    timestamp: Date.now()
  };
  
  console.log(`[FirestoreCleanup] Registered listener for ${pageId}. Total active: ${getActiveListenerCount()}`);
};

// Function to clean up a specific listener
export const cleanupListener = (pageId: string): void => {
  if (activeListeners[pageId]) {
    console.log(`[FirestoreCleanup] Cleaning up listener for ${pageId}`);
    activeListeners[pageId].cleanup();
    delete activeListeners[pageId];
    console.log(`[FirestoreCleanup] Total active listeners: ${getActiveListenerCount()}`);
  }
};

// Function to clean up all listeners
export const cleanupAllListeners = (): void => {
  console.log(`[FirestoreCleanup] Cleaning up all ${getActiveListenerCount()} listeners`);
  
  Object.entries(activeListeners).forEach(([pageId, listener]) => {
    listener.cleanup();
    delete activeListeners[pageId];
  });
  
  console.log('[FirestoreCleanup] All listeners cleaned up');
};

// Hook to manage Firestore listeners for a specific page/component
export const useFirestoreListenerCleanup = (pageId: string) => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const cleanupFunctions = useRef<Array<() => void>>([]);
  
  // Register a listener for this component
  const registerListener = (cleanup: () => void) => {
    cleanupFunctions.current.push(cleanup);
    setIsActive(true);
    
    // Also register with the global system
    registerGlobalListener(`${pageId}-${cleanupFunctions.current.length}`, cleanup);
    
    return () => {
      // This is the cleanup function that will be called when the component unmounts
      // or when the listener is no longer needed
      cleanup();
      
      // Also clean up from the global registry
      cleanupListener(`${pageId}-${cleanupFunctions.current.length}`);
    };
  };
  
  // Clean up all listeners when the component unmounts
  useEffect(() => {
    return () => {
      console.log(`[FirestoreCleanup] Component with pageId ${pageId} unmounting, cleaning up ${cleanupFunctions.current.length} listeners`);
      
      cleanupFunctions.current.forEach((cleanup, index) => {
        cleanup();
        cleanupListener(`${pageId}-${index + 1}`);
      });
      
      cleanupFunctions.current = [];
      setIsActive(false);
    };
  }, [pageId]);
  
  return {
    registerListener,
    isActive,
    listenerCount: cleanupFunctions.current.length
  };
};

// Hook to automatically clean up all listeners when navigating away from a listing page
export const useListingPageCleanup = (listingId: string | null | undefined) => {
  useEffect(() => {
    // When the component mounts, we register that we're viewing this listing
    if (listingId) {
      console.log(`[FirestoreCleanup] Viewing listing ${listingId}`);
    }
    
    // When the component unmounts (user navigates away), clean up all listeners
    return () => {
      if (listingId) {
        console.log(`[FirestoreCleanup] Navigating away from listing ${listingId}, cleaning up listeners`);
        
        // Find and clean up any listeners related to this listing
        Object.keys(activeListeners).forEach(key => {
          if (key.includes(`similar-listings-${listingId}`) || 
              key.includes(`listing-${listingId}`) ||
              key.includes(`listing-view-${listingId}`)) {
            cleanupListener(key);
          }
        });
      }
    };
  }, [listingId]);
  
  return null;
};