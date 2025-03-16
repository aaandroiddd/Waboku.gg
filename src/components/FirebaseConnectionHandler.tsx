import { useEffect, useState } from 'react';
import { connectionManager } from '@/lib/firebase';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';

export function FirebaseConnectionHandler() {
  const [connectionError, setConnectionError] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    if (!connectionManager) return;

    // Setup error event listener
    const handleError = (event: ErrorEvent) => {
      // Check if the error is related to Firebase/Firestore
      if (
        event.message.includes('firestore') ||
        event.message.includes('firebase') ||
        event.message.includes('Failed to fetch')
      ) {
        console.log('[ConnectionHandler] Detected Firebase-related error:', event.message);
        setConnectionError(true);
        setErrorCount(prev => prev + 1);
        
        // Only show the alert after multiple errors to avoid false positives
        if (errorCount >= 2) {
          setShowAlert(true);
        }
      }
    };

    // Listen for global errors
    window.addEventListener('error', handleError);

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (
        event.reason?.message?.includes('firestore') ||
        event.reason?.message?.includes('firebase') ||
        event.reason?.message?.includes('Failed to fetch')
      ) {
        console.log('[ConnectionHandler] Detected Firebase-related promise rejection:', event.reason.message);
        setConnectionError(true);
        setErrorCount(prev => prev + 1);
        
        // Only show the alert after multiple errors to avoid false positives
        if (errorCount >= 2) {
          setShowAlert(true);
        }
      }
    });

    // Add connection listener from our connection manager
    const removeListener = connectionManager.addConnectionListener(() => {
      console.log('[ConnectionHandler] Connection status changed');
      setConnectionError(false);
      setShowAlert(false);
      setErrorCount(0);
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
      removeListener();
    };
  }, [errorCount]);

  const handleReconnect = () => {
    setIsReconnecting(true);
    
    // Force page refresh as a last resort
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowAlert(false);
  };

  // Only render if there's a connection error and we should show the alert
  if (!showAlert) return null;

  return (
    <AnimatePresence>
      {showAlert && (
        <motion.div
          className="fixed bottom-4 right-4 z-50 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <div className="flex-1">
              <AlertTitle className="text-amber-500">Connection Issue</AlertTitle>
              <AlertDescription className="text-sm">
                We're having trouble connecting to our servers. This might affect some features.
              </AlertDescription>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-xs h-8 bg-amber-500 hover:bg-amber-600"
                onClick={handleReconnect}
                disabled={isReconnecting}
              >
                {isReconnecting ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reconnect
                  </>
                )}
              </Button>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}