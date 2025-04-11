import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  DocumentData, 
  QuerySnapshot,
  Query,
  DocumentReference,
  DocumentSnapshot,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useManagedListener } from '@/components/FirestoreListenerManager';

/**
 * Hook to listen to a Firestore query with proper listener management
 * @param queryOrRef The Firestore query or document reference to listen to
 * @param deps Dependencies array to control when the listener should be recreated
 * @returns Object containing data, loading state, and error
 */
export function useFirestoreListener<T = DocumentData>(
  queryOrRef: Query<T> | DocumentReference<T> | null,
  deps: any[] = []
) {
  const [data, setData] = useState<T | T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use our managed listener hook
  useManagedListener(
    queryOrRef,
    (snapshot) => {
      try {
        if (snapshot instanceof QuerySnapshot) {
          // Handle query snapshots
          const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          setData(results);
        } else if (snapshot instanceof DocumentSnapshot) {
          // Handle document snapshots
          if (snapshot.exists()) {
            setData({
              id: snapshot.id,
              ...snapshot.data()
            } as T);
          } else {
            setData(null);
          }
        }
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error processing Firestore snapshot:', err);
        setError(err instanceof Error ? err : new Error('Unknown error processing snapshot'));
        setLoading(false);
      }
    },
    (err) => {
      console.error('Firestore listener error:', err);
      setError(err);
      setLoading(false);
    },
    deps
  );

  return { data, loading, error };
}

/**
 * Hook to listen to a Firestore collection with proper listener management
 * @param collectionPath The path to the collection
 * @param constraints Array of query constraints (where, orderBy, limit, etc.)
 * @param deps Dependencies array to control when the listener should be recreated
 * @returns Object containing data, loading state, and error
 */
export function useCollectionListener<T = DocumentData>(
  collectionPath: string,
  constraints: any[] = [],
  deps: any[] = []
) {
  const [queryRef, setQueryRef] = useState<Query<T> | null>(null);

  // Create the query
  useEffect(() => {
    if (!db) {
      console.error('Firestore not initialized');
      return;
    }

    try {
      const collectionRef = collection(db, collectionPath) as any;
      const queryRef = constraints.length > 0 
        ? query(collectionRef, ...constraints)
        : query(collectionRef);
      
      setQueryRef(queryRef);
    } catch (err) {
      console.error('Error creating Firestore query:', err);
    }
  }, [collectionPath, ...constraints]);

  return useFirestoreListener(queryRef, deps);
}

/**
 * Hook to listen to a Firestore document with proper listener management
 * @param documentPath The path to the document
 * @param deps Dependencies array to control when the listener should be recreated
 * @returns Object containing data, loading state, and error
 */
export function useDocumentListener<T = DocumentData>(
  documentPath: string | null,
  deps: any[] = []
) {
  const [docRef, setDocRef] = useState<DocumentReference<T> | null>(null);

  // Create the document reference
  useEffect(() => {
    if (!db || !documentPath) {
      return;
    }

    try {
      const ref = db.doc(documentPath) as DocumentReference<T>;
      setDocRef(ref);
    } catch (err) {
      console.error('Error creating Firestore document reference:', err);
    }
  }, [documentPath]);

  return useFirestoreListener(docRef, deps);
}