import { useEffect, useRef } from 'react';
import { 
  registerListener, 
  removeListener, 
  removeListenersByPrefix 
} from '@/lib/firebase-service';
import { 
  DocumentReference, 
  CollectionReference, 
  Query, 
  onSnapshot 
} from 'firebase/firestore';

/**
 * Hook to manage Firestore listeners with automatic cleanup
 * @param componentId Unique identifier for the component using this hook
 */
export function useFirestoreListener(componentId: string) {
  const listenersRef = useRef<string[]>([]);
  
  // Register a listener with automatic cleanup
  const addListener = <T>(
    listenerId: string,
    ref: DocumentReference<T> | CollectionReference<T> | Query<T>,
    callback: (data: any) => void,
    errorCallback?: (error: Error) => void
  ) => {
    // Create a unique ID for this listener
    const uniqueId = `${componentId}-${listenerId}`;
    
    // Register the listener
    registerListener(uniqueId, ref, callback, errorCallback);
    
    // Keep track of this listener ID
    listenersRef.current.push(uniqueId);
    
    // Return a function to remove this specific listener
    return () => {
      removeListener(uniqueId);
      listenersRef.current = listenersRef.current.filter(id => id !== uniqueId);
    };
  };
  
  // Clean up all listeners when the component unmounts
  useEffect(() => {
    return () => {
      // Clean up all listeners registered by this component
      removeListenersByPrefix(componentId);
      listenersRef.current = [];
    };
  }, [componentId]);
  
  return {
    addListener,
    getActiveListenerCount: () => listenersRef.current.length
  };
}

/**
 * Hook to automatically clean up all listeners when navigating away from a listing page
 */
export function useListingPageCleanup(listingId: string | null | undefined) {
  useEffect(() => {
    // When the component unmounts (user navigates away), clean up all listeners
    return () => {
      if (listingId) {
        console.log(`[Firebase] Navigating away from listing ${listingId}, cleaning up listeners`);
        
        // Clean up any listeners related to this listing
        removeListenersByPrefix(`listing-${listingId}`);
        removeListenersByPrefix(`similar-listings-${listingId}`);
        removeListenersByPrefix(`listing-view-${listingId}`);
        
        // Also clean up any cached data for this listing
        if (typeof window !== 'undefined' && (window as any).__firestoreCache?.similarListings) {
          console.log(`[Firebase] Cleaning up cache for listing ${listingId}`);
          delete (window as any).__firestoreCache.similarListings[listingId];
        }
      }
    };
  }, [listingId]);
  
  return null;
}