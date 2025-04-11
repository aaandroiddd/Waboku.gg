import { useEffect, useRef } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { FirestoreListenerManager } from './FirestoreListenerManager';

interface FirebaseConnectionHandlerProps {
  children?: React.ReactNode;
}

export function FirebaseConnectionHandler({ children }: FirebaseConnectionHandlerProps) {
  const initRef = useRef(false);
  
  // Silently initialize Firebase services in the background
  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initRef.current) return;
    initRef.current = true;
    
    const initFirebase = async () => {
      try {
        await getFirebaseServices();
      } catch (error) {
        console.error("Firebase initialization error:", error);
        // Silently handle errors - no UI feedback
      }
    };
    
    initFirebase();
  }, []);

  // Wrap children with FirestoreListenerManager to manage Firestore listeners
  return <FirestoreListenerManager>{children}</FirestoreListenerManager>;
}