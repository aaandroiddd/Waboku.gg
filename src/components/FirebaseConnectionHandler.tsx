import { useEffect, useState } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { fixFirestoreListenChannel } from '@/lib/firebase-connection-fix';

interface FirebaseConnectionHandlerProps {
  children?: React.ReactNode;
  autoFix?: boolean;
}

export function FirebaseConnectionHandler({ 
  children, 
  autoFix = false 
}: FirebaseConnectionHandlerProps) {
  const [initError, setInitError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFixingConnection, setIsFixingConnection] = useState(false);

  // Initialize Firebase services in the background
  useEffect(() => {
    const initFirebase = async () => {
      try {
        // Use getFirebaseServices instead of initializeFirebaseServices
        const services = await getFirebaseServices();
        
        // Check if initialization was successful
        if (!services.db || !services.auth) {
          console.error("Firebase services not fully initialized:", services);
          setInitError(new Error("Firebase services not fully initialized"));
          return;
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error("Firebase initialization error:", error);
        setInitError(error instanceof Error ? error : new Error("Unknown Firebase initialization error"));
        
        // If autoFix is enabled, try to fix the connection
        if (autoFix) {
          tryFixConnection();
        }
      }
    };
    
    initFirebase();
    
    // Add a global error handler for Firestore fetch errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && 
          (event.reason.message === 'Failed to fetch' || 
           (event.reason.stack && event.reason.stack.includes('firestore.googleapis.com')))) {
        console.error('Detected Firestore fetch error:', event.reason);
        
        // If autoFix is enabled, try to fix the connection
        if (autoFix && !isFixingConnection) {
          tryFixConnection();
        }
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [autoFix]);
  
  // Function to attempt fixing the connection
  const tryFixConnection = async () => {
    if (isFixingConnection) return;
    
    setIsFixingConnection(true);
    try {
      console.log("Attempting to fix Firestore connection...");
      await fixFirestoreListenChannel();
      console.log("Connection fix completed");
      
      // Reset error state
      setInitError(null);
    } catch (error) {
      console.error("Error fixing connection:", error);
    } finally {
      setIsFixingConnection(false);
    }
  };

  // Simply render children without any connection check UI
  return <>{children}</>;
}