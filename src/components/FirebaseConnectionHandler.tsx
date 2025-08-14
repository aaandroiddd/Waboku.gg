import { useEffect, useState } from 'react';
import { getFirebaseServices } from '@/lib/firebase';

interface FirebaseConnectionHandlerProps {
  children?: React.ReactNode;
}

export function FirebaseConnectionHandler({ 
  children
}: FirebaseConnectionHandlerProps) {
  const [initError, setInitError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Firebase services in the background
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const services = getFirebaseServices();
        
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
      }
    };
    
    initFirebase();
  }, []);

  // UI: Show error banner if connection error is detected
  return (
    <>
      {initError && (
        <div className="fixed top-0 left-0 w-full z-[1000] bg-red-600 text-white flex flex-col md:flex-row items-center justify-between px-4 py-3 shadow-lg">
          <div className="flex-1 flex flex-col md:flex-row items-center gap-2">
            <span className="font-semibold">Connection Error:</span>
            <span>
              {initError.message.includes('Failed to fetch')
                ? 'Unable to connect to the database. Please check your internet connection or try refreshing the page.'
                : initError.message}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <button
              onClick={() => window.location.reload()}
              className="bg-white text-red-700 font-semibold px-3 py-1 rounded hover:bg-amber-100 transition"
            >
              Refresh Page
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