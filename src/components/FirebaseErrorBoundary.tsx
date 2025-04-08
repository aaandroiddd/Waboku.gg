import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { getFirebaseServices, connectionManager } from '@/lib/firebase';

interface FirebaseErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FirebaseErrorBoundary({ 
  children, 
  fallback 
}: FirebaseErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Check Firebase connection on mount
  useEffect(() => {
    const checkFirebaseConnection = async () => {
      try {
        const services = getFirebaseServices();
        if (!services.app || !services.db) {
          console.error('[FirebaseErrorBoundary] Firebase services not properly initialized');
          setHasError(true);
          setErrorDetails('Firebase connection issue detected. This might affect some app features.');
        } else {
          setHasError(false);
          setErrorDetails(null);
        }
      } catch (error) {
        console.error('[FirebaseErrorBoundary] Error checking Firebase connection:', error);
        setHasError(true);
        setErrorDetails('Error connecting to Firebase services.');
      }
    };

    checkFirebaseConnection();

    // Add connection listener if available
    let removeListener: (() => void) | undefined;
    if (connectionManager) {
      removeListener = connectionManager.addConnectionListener(() => {
        // When connection status changes, recheck
        checkFirebaseConnection();
      });
    }

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    try {
      // Attempt to reinitialize Firebase services
      const services = getFirebaseServices();
      
      // Wait a moment to allow connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (services.app && services.db) {
        setHasError(false);
        setErrorDetails(null);
      } else {
        setErrorDetails('Still having trouble connecting to Firebase. Please try again later.');
      }
    } catch (error) {
      console.error('[FirebaseErrorBoundary] Error during retry:', error);
      setErrorDetails('Failed to reconnect to Firebase services.');
    } finally {
      setIsRetrying(false);
    }
  };

  if (hasError) {
    return (
      <>
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Connection Issue</AlertTitle>
          <AlertDescription>
            {errorDetails || 'There was a problem connecting to our services.'}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Reconnecting...' : 'Retry Connection'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        {fallback || children}
      </>
    );
  }

  return <>{children}</>;
}