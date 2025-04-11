import { useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { onSnapshot, Query, DocumentReference, Unsubscribe } from 'firebase/firestore';

// This component helps manage Firestore listeners to prevent duplicate listeners
// and ensure proper cleanup when components unmount

interface FirestoreListenerManagerProps {
  children: React.ReactNode;
}

// Create a global registry to track active listeners
const globalListenerRegistry: Map<string, {
  unsubscribe: Unsubscribe;
  lastAccessed: number;
  refCount: number;
}> = new Map();

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Function to generate a unique key for a query or document reference
export function getListenerKey(target: Query | DocumentReference): string {
  if ('path' in target) {
    return target.path;
  }
  
  // For queries, we need to create a key based on the available properties
  // This is a simplified approach and might need enhancement for complex queries
  return JSON.stringify({
    path: target.firestore.app.name + '/' + (target as any)._query?.path?.segments?.join('/') || 'unknown',
    filters: (target as any)._query?.filters || [],
    orderBy: (target as any)._query?.orderBy || [],
    limit: (target as any)._query?.limit || null,
  });
}

// Function to create a managed listener
export function createManagedListener<T>(
  target: Query<T> | DocumentReference<T>,
  onNext: (snapshot: any) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const key = getListenerKey(target);
  
  // Check if we already have this listener
  if (globalListenerRegistry.has(key)) {
    // Update the access time and increment ref count
    const existingListener = globalListenerRegistry.get(key)!;
    existingListener.lastAccessed = Date.now();
    existingListener.refCount++;
    
    console.log(`[FirestoreListener] Reusing existing listener for: ${key}, ref count: ${existingListener.refCount}`);
    
    // Return a function that will decrement the ref count when called
    return () => {
      const listener = globalListenerRegistry.get(key);
      if (listener) {
        listener.refCount--;
        listener.lastAccessed = Date.now();
        
        console.log(`[FirestoreListener] Decremented ref count for: ${key}, new count: ${listener.refCount}`);
        
        // If ref count is 0, we could unsubscribe immediately, but we'll let the cleanup interval handle it
        // to allow for quick re-subscriptions without creating new listeners
      }
    };
  }
  
  // Create a new listener
  console.log(`[FirestoreListener] Creating new listener for: ${key}`);
  const unsubscribe = onSnapshot(
    target,
    (snapshot) => {
      // Update last accessed time
      const listener = globalListenerRegistry.get(key);
      if (listener) {
        listener.lastAccessed = Date.now();
      }
      
      // Call the provided callback
      onNext(snapshot);
    },
    (error) => {
      console.error(`[FirestoreListener] Error in listener for ${key}:`, error);
      if (onError) {
        onError(error);
      }
    }
  );
  
  // Register the new listener
  globalListenerRegistry.set(key, {
    unsubscribe,
    lastAccessed: Date.now(),
    refCount: 1
  });
  
  // Return a function that will decrement the ref count when called
  return () => {
    const listener = globalListenerRegistry.get(key);
    if (listener) {
      listener.refCount--;
      listener.lastAccessed = Date.now();
      
      console.log(`[FirestoreListener] Decremented ref count for: ${key}, new count: ${listener.refCount}`);
      
      // If ref count is 0, we could unsubscribe immediately, but we'll let the cleanup interval handle it
    }
  };
}

// Hook to use a managed listener in components
export function useManagedListener<T>(
  target: Query<T> | DocumentReference<T> | null,
  onNext: (snapshot: any) => void,
  onError?: (error: Error) => void,
  dependencies: any[] = []
): void {
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  
  useEffect(() => {
    // Clean up previous listener if it exists
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Don't set up a new listener if target is null
    if (!target) return;
    
    // Create a new managed listener
    unsubscribeRef.current = createManagedListener(target, onNext, onError);
    
    // Clean up when component unmounts or dependencies change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ...dependencies]);
}

export function FirestoreListenerManager({ children }: FirestoreListenerManagerProps) {
  // Set up a cleanup interval to remove unused listeners
  useEffect(() => {
    // Skip on server
    if (typeof window === 'undefined') return;
    
    console.log('[FirestoreListenerManager] Setting up cleanup interval');
    
    const intervalId = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      globalListenerRegistry.forEach((listener, key) => {
        // If the listener hasn't been accessed in the cleanup interval and has no references,
        // we can safely unsubscribe and remove it
        if (listener.refCount <= 0 && now - listener.lastAccessed > CLEANUP_INTERVAL) {
          try {
            listener.unsubscribe();
            globalListenerRegistry.delete(key);
            cleanedCount++;
          } catch (error) {
            console.error(`[FirestoreListenerManager] Error cleaning up listener for ${key}:`, error);
          }
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`[FirestoreListenerManager] Cleaned up ${cleanedCount} unused listeners. Remaining: ${globalListenerRegistry.size}`);
      }
    }, CLEANUP_INTERVAL);
    
    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(intervalId);
      
      // Unsubscribe from all listeners when the app is shutting down
      globalListenerRegistry.forEach((listener, key) => {
        try {
          listener.unsubscribe();
          console.log(`[FirestoreListenerManager] Unsubscribed from listener: ${key}`);
        } catch (error) {
          console.error(`[FirestoreListenerManager] Error unsubscribing from listener for ${key}:`, error);
        }
      });
      
      globalListenerRegistry.clear();
    };
  }, []);
  
  return <>{children}</>;
}

// Export a function to get the current listener count (useful for debugging)
export function getActiveListenerCount(): number {
  return globalListenerRegistry.size;
}

// Export a function to manually clean up all listeners (useful for logout)
export function cleanupAllListeners(): void {
  globalListenerRegistry.forEach((listener, key) => {
    try {
      listener.unsubscribe();
      console.log(`[FirestoreListenerManager] Manually unsubscribed from listener: ${key}`);
    } catch (error) {
      console.error(`[FirestoreListenerManager] Error manually unsubscribing from listener for ${key}:`, error);
    }
  });
  
  globalListenerRegistry.clear();
}