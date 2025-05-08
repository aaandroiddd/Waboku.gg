import { useEffect } from 'react';
import { getFirebaseServices } from '@/lib/firebase';

interface FirebaseConnectionHandlerProps {
  children?: React.ReactNode;
}

export function FirebaseConnectionHandler({ children }: FirebaseConnectionHandlerProps) {
  // Silently initialize Firebase services in the background
  useEffect(() => {
    const initFirebase = async () => {
      try {
        // Use getFirebaseServices instead of initializeFirebaseServices
        await getFirebaseServices();
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