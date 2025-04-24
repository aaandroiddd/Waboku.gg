import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  QueryConstraint, 
  DocumentReference, 
  CollectionReference, 
  Query, 
  Firestore 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Global registry to track active listeners
interface ListenerRegistry {
  [key: string]: {
    count: number;
    lastAccessed: number;
  };
}

// In-memory registry of active listeners
const listenerRegistry: ListenerRegistry = {};

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Set up periodic cleanup of unused listeners
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    Object.keys(listenerRegistry).forEach(key => {
      const listener = listenerRegistry[key];
      // If listener hasn't been accessed in 10 minutes and has no active references
      if (now - listener.lastAccessed > 10 * 60 * 1000 && listener.count === 0) {
        delete listenerRegistry[key];
      }
    });
  }, CLEANUP_INTERVAL);
}

/**
 * Custom hook for efficiently managing Firestore document listeners
 * 
 * @param docRef Document reference or path string
 * @returns The document data and loading state
 */
export function useFirestoreDoc<T>(docRef: DocumentReference | string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<() => void | undefined>();
  const listenerKeyRef = useRef<string>('');

  useEffect(() => {
    // Skip if Firestore is not available
    if (!db) {
      setLoading(false);
      setError(new Error('Firestore is not initialized'));
      return;
    }

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      
      // Decrement listener count in registry
      if (listenerKeyRef.current && listenerRegistry[listenerKeyRef.current]) {
        listenerRegistry[listenerKeyRef.current].count--;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Get document reference
      const documentRef = typeof docRef === 'string' 
        ? doc(db as Firestore, docRef) 
        : docRef;
      
      // Create a unique key for this listener
      const listenerKey = documentRef.path;
      listenerKeyRef.current = listenerKey;
      
      // Update or create registry entry
      if (listenerRegistry[listenerKey]) {
        listenerRegistry[listenerKey].count++;
        listenerRegistry[listenerKey].lastAccessed = Date.now();
      } else {
        listenerRegistry[listenerKey] = {
          count: 1,
          lastAccessed: Date.now()
        };
      }

      // Set up the listener
      const unsubscribe = onSnapshot(
        documentRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setData(snapshot.data() as T);
          } else {
            setData(null);
          }
          setLoading(false);
          
          // Update last accessed time
          if (listenerRegistry[listenerKey]) {
            listenerRegistry[listenerKey].lastAccessed = Date.now();
          }
        },
        (err) => {
          console.error(`Error in Firestore listener for ${listenerKey}:`, err);
          setError(err);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;

      // Clean up on unmount
      return () => {
        unsubscribe();
        
        // Decrement listener count in registry
        if (listenerRegistry[listenerKey]) {
          listenerRegistry[listenerKey].count--;
        }
      };
    } catch (err) {
      console.error('Error setting up Firestore listener:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [docRef]);

  return { data, loading, error };
}

/**
 * Custom hook for efficiently managing Firestore collection listeners
 * 
 * @param collectionRef Collection reference, path string, or query
 * @param queryConstraints Optional query constraints if using a path string
 * @returns The collection data and loading state
 */
export function useFirestoreCollection<T>(
  collectionRef: CollectionReference | string | Query,
  queryConstraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<() => void | undefined>();
  const listenerKeyRef = useRef<string>('');

  useEffect(() => {
    // Skip if Firestore is not available
    if (!db) {
      setLoading(false);
      setError(new Error('Firestore is not initialized'));
      return;
    }

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      
      // Decrement listener count in registry
      if (listenerKeyRef.current && listenerRegistry[listenerKeyRef.current]) {
        listenerRegistry[listenerKeyRef.current].count--;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Get collection reference or query
      let queryRef: Query;
      
      if (typeof collectionRef === 'string') {
        // If it's a string path, create a collection reference and apply query constraints
        const collRef = collection(db as Firestore, collectionRef);
        queryRef = query(collRef, ...queryConstraints);
      } else if ('type' in collectionRef && collectionRef.type === 'query') {
        // If it's already a query, use it directly
        queryRef = collectionRef as Query;
      } else {
        // If it's a collection reference, apply query constraints
        queryRef = query(collectionRef as CollectionReference, ...queryConstraints);
      }
      
      // Create a unique key for this listener
      // For queries, we use a simplified representation
      const listenerKey = typeof collectionRef === 'string' 
        ? `${collectionRef}:${queryConstraints.length}` 
        : (collectionRef as any).path || 'query';
      
      listenerKeyRef.current = listenerKey;
      
      // Update or create registry entry
      if (listenerRegistry[listenerKey]) {
        listenerRegistry[listenerKey].count++;
        listenerRegistry[listenerKey].lastAccessed = Date.now();
      } else {
        listenerRegistry[listenerKey] = {
          count: 1,
          lastAccessed: Date.now()
        };
      }

      // Set up the listener
      const unsubscribe = onSnapshot(
        queryRef,
        (snapshot) => {
          const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          
          setData(documents);
          setLoading(false);
          
          // Update last accessed time
          if (listenerRegistry[listenerKey]) {
            listenerRegistry[listenerKey].lastAccessed = Date.now();
          }
        },
        (err) => {
          console.error(`Error in Firestore collection listener for ${listenerKey}:`, err);
          setError(err);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;

      // Clean up on unmount
      return () => {
        unsubscribe();
        
        // Decrement listener count in registry
        if (listenerRegistry[listenerKey]) {
          listenerRegistry[listenerKey].count--;
        }
      };
    } catch (err) {
      console.error('Error setting up Firestore collection listener:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [collectionRef, JSON.stringify(queryConstraints)]);

  return { data, loading, error };
}

/**
 * Get the current count of active Firestore listeners
 */
export function getActiveListenersCount(): number {
  return Object.values(listenerRegistry).reduce((total, listener) => total + listener.count, 0);
}

/**
 * Get details about all active listeners for debugging
 */
export function getActiveListenersDetails(): { path: string; count: number; lastAccessed: Date }[] {
  return Object.entries(listenerRegistry).map(([path, details]) => ({
    path,
    count: details.count,
    lastAccessed: new Date(details.lastAccessed)
  }));
}