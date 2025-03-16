import { useEffect, useState, useCallback } from 'react';
import { connectionManager, db, disableNetwork, enableNetwork } from '@/lib/firebase';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';

export function FirebaseConnectionHandler() {
  const [connectionError, setConnectionError] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [lastReconnectAttempt, setLastReconnectAttempt] = useState(0);

  // More aggressive reconnection strategy
  const attemptReconnection = useCallback(async () => {
    if (!db) return;
    
    console.log('[ConnectionHandler] Attempting manual reconnection to Firestore');
    setIsReconnecting(true);
    
    try {
      // First disable the network to reset any hanging connections
      await disableNetwork(db);
      console.log('[ConnectionHandler] Network disabled successfully');
      
      // Short delay to ensure disconnection is complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then re-enable the network
      await enableNetwork(db);
      console.log('[ConnectionHandler] Network re-enabled successfully');
      
      // Reset error state
      setConnectionError(false);
      setErrorCount(0);
      setShowAlert(false);
      
      console.log('[ConnectionHandler] Manual reconnection completed successfully');
    } catch (error) {
      console.error('[ConnectionHandler] Error during manual reconnection:', error);
      
      // If reconnection fails, we'll try a page refresh as a last resort
      if (window.navigator.onLine) {
        console.log('[ConnectionHandler] Reconnection failed, refreshing page');
        window.location.reload();
      }
    } finally {
      setIsReconnecting(false);
      setLastReconnectAttempt(Date.now());
    }
  }, [db]);

  // Handle errors and trigger reconnection
  const handleFirebaseError = useCallback((errorMessage: string) => {
    console.log('[ConnectionHandler] Detected Firebase-related error:', errorMessage);
    
    // Update error state
    setConnectionError(true);
    setErrorCount(prev => prev + 1);
    
    // Only show the alert after multiple errors to avoid false positives
    // or if it's been a while since we last showed it
    const newErrorCount = errorCount + 1;
    if (newErrorCount >= 2) {
      setShowAlert(true);
      
      // Auto-attempt reconnection if we're seeing multiple errors
      // and it's been at least 30 seconds since our last attempt
      const timeSinceLastAttempt = Date.now() - lastReconnectAttempt;
      if (newErrorCount >= 3 && timeSinceLastAttempt > 30000 && !isReconnecting) {
        attemptReconnection();
      }
    }
  }, [errorCount, lastReconnectAttempt, isReconnecting, attemptReconnection]);

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
        handleFirebaseError(event.message);
      }
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || 'Unknown error';
      if (
        errorMessage.includes('firestore') ||
        errorMessage.includes('firebase') ||
        errorMessage.includes('Failed to fetch')
      ) {
        handleFirebaseError(errorMessage);
      }
    };

    // Listen for global errors
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Add connection listener from our connection manager
    const removeListener = connectionManager.addConnectionListener(() => {
      console.log('[ConnectionHandler] Connection status changed');
      setConnectionError(false);
      setShowAlert(false);
      setErrorCount(0);
    });

    // Also listen for online/offline events
    const handleOnline = () => {
      console.log('[ConnectionHandler] Browser went online');
      if (connectionError) {
        // Attempt reconnection when coming back online
        attemptReconnection();
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('online', handleOnline);
      removeListener();
    };
  }, [connectionError, errorCount, handleFirebaseError, attemptReconnection]);

  const handleReconnect = () => {
    attemptReconnection();
  };

  const handleDismiss = () => {
    setShowAlert(false);
    // Reset error count when dismissed
    setErrorCount(0);
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
                {errorCount > 5 && " If this persists, try clearing your browser cache or using a different browser."}
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