import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import { getFirebaseServices } from '@/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

interface FirebaseConnectionHandlerProps {
  children: React.ReactNode;
}

export function FirebaseConnectionHandler({ children }: FirebaseConnectionHandlerProps) {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      setErrorMessage(null);
      
      // Set a timeout for the connection check
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out")), 10000);
      });
      
      // Try to fetch a small amount of data from Firestore
      const fetchData = async () => {
        const { db } = await getFirebaseServices();
        const testQuery = query(collection(db, 'listings'), limit(1));
        await getDocs(testQuery);
        return true;
      };
      
      // Race between the fetch and the timeout
      await Promise.race([fetchData(), timeoutPromise]);
      
      // If we get here, the connection was successful
      setConnectionStatus('connected');
    } catch (error) {
      console.error("Firebase connection error:", error);
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Check connection on mount and when retryCount changes
  useEffect(() => {
    checkConnection();
  }, [retryCount]);

  // If connected, just render children
  if (connectionStatus === 'connected') {
    return <>{children}</>;
  }

  // If checking, show a loading indicator
  if (connectionStatus === 'checking') {
    return (
      <div className="p-4 border rounded-lg bg-card mb-4">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <p>Checking database connection...</p>
        </div>
        {children}
      </div>
    );
  }

  // If error, show an error message with retry button
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>Database Connection Error</AlertTitle>
        <AlertDescription>
          <div className="mt-2 space-y-2">
            <p>There was a problem connecting to the database: {errorMessage}</p>
            <p>This could be due to network issues or temporary service disruption.</p>
            <div className="mt-4">
              <Button 
                onClick={() => setRetryCount(prev => prev + 1)}
                variant="outline"
              >
                Retry Connection
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>
      
      {/* Still render children so the UI doesn't completely break */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    </div>
  );
}