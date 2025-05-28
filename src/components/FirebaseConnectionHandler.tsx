import { useEffect, useState, useCallback } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
import { fixFirestoreListenChannel, clearFirestoreCaches } from '@/lib/firebase-connection-fix';

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

  // Function to attempt fixing the connection
  const tryFixConnection = useCallback(async () => {
    if (isFixingConnection) return;
    
    setIsFixingConnection(true);
    try {
      console.log("Attempting to fix Firestore connection...");
      
      // First clear all caches
      await clearFirestoreCaches();
      console.log("Cleared Firestore caches");
      
      // Then fix the Listen channel
      await fixFirestoreListenChannel();
      console.log("Connection fix completed");
      
      // Reset error state
      setInitError(null);
    } catch (error) {
      console.error("Error fixing connection:", error);
    } finally {
      setIsFixingConnection(false);
    }
  }, [isFixingConnection]);

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
  


  // UI: Show error banner if connection error is detected
  return (
    <>
      {initError && (
        <div className="fixed top-0 left-0 w-full z-[1000] bg-red-600 text-white flex flex-col md:flex-row items-center justify-between px-4 py-3 shadow-lg">
          <div className="flex-1 flex flex-col md:flex-row items-center gap-2">
            <span className="font-semibold">Connection Error:</span>
            <span>
              {initError.message.includes('Failed to fetch')
                ? 'Unable to connect to the database. Please check your internet connection, disable VPN/adblock, or try again.'
                : initError.message}
            </span>
            <a
              href="/connection-troubleshoot"
              className="underline text-white hover:text-amber-200 ml-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Connection Help
            </a>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <button
              onClick={tryFixConnection}
              disabled={isFixingConnection}
              className="bg-white text-red-700 font-semibold px-3 py-1 rounded hover:bg-amber-100 transition disabled:opacity-60"
            >
              {isFixingConnection ? "Retrying..." : "Retry Connection"}
            </button>
            <button
              onClick={() => setInitError(null)}
              className="ml-2 text-white/80 hover:text-white text-lg"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}