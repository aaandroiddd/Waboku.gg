import { useEffect } from 'react';
import { initializeFirebaseServices } from '@/lib/firebase-service';

interface FirebaseConnectionHandlerProps {
  children?: React.ReactNode;
}

export function FirebaseConnectionHandler({ children }: FirebaseConnectionHandlerProps) {
  // Silently initialize Firebase services in the background
  useEffect(() => {
    const initFirebase = async () => {
      try {
        await initializeFirebaseServices();
      } catch (error) {
        console.error("Firebase initialization error:", error);
        // Silently handle errors - no UI feedback
      }
    };
    
    initFirebase();
  }, []);

  // Simply render children without any connection check UI
  return <>{children}</>;
}