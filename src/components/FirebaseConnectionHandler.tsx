import { useEffect, useState, useCallback, useRef } from 'react';
import { connectionManager, db, disableNetwork, enableNetwork } from '@/lib/firebase';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';

// Known problematic listing IDs that should be ignored
const PROBLEMATIC_LISTING_IDS = new Set([
  'CqxNR6z76xXKon3V3BM1',
  'ufKDqtR3DUt2Id2RdLfi'
]);

export function FirebaseConnectionHandler() {
  const router = useRouter();
  const [connectionError, setConnectionError] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const lastReconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef<boolean>(false);
  
  // Check if we're on the front page
  const isHomePage = router.pathname === '/';
  
  // Track errors with debouncing to prevent excessive reconnection attempts
  const errorTracker = useRef<{
    count: number;
    lastErrorTime: number;
    errors: Set<string>;
  }>({
    count: 0,
    lastErrorTime: 0,
    errors: new Set()
  });

  // More aggressive reconnection strategy with debouncing
  const attemptReconnection = useCallback(async () => {
    if (!db || isReconnectingRef.current) return;
    
    // Prevent multiple simultaneous reconnection attempts
    isReconnectingRef.current = true;
    setIsReconnecting(true);
    lastReconnectAttemptRef.current = Date.now();
    
    console.log('[ConnectionHandler] Attempting manual reconnection to Firestore');
    
    try {
      // First disable the network to reset any hanging connections
      await disableNetwork(db);
      console.log('[ConnectionHandler] Network disabled successfully');
      
      // Short delay to ensure disconnection is complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Then re-enable the network
      await enableNetwork(db);
      console.log('[ConnectionHandler] Network re-enabled successfully');
      
      // Reset error state after successful reconnection
      errorTracker.current = {
        count: 0,
        lastErrorTime: 0,
        errors: new Set()
      };
      
      setConnectionError(false);
      setErrorCount(0);
      setShowAlert(false);
      
      console.log('[ConnectionHandler] Manual reconnection completed successfully');
    } catch (error) {
      console.error('[ConnectionHandler] Error during manual reconnection:', error);
      
      // Schedule another reconnection attempt with exponential backoff
      const backoffDelay = Math.min(5000 * Math.pow(1.5, errorTracker.current.count), 60000);
      console.log(`[ConnectionHandler] Scheduling next reconnection attempt in ${backoffDelay}ms`);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        isReconnectingRef.current = false;
        if (errorTracker.current.count > 0) {
          attemptReconnection();
        }
      }, backoffDelay);
    } finally {
      // Allow new reconnection attempts after a delay
      setTimeout(() => {
        isReconnectingRef.current = false;
        setIsReconnecting(false);
      }, 5000);
    }
  }, [db]);

  // Handle errors with improved debouncing and deduplication
  const handleFirebaseError = useCallback((errorMessage: string) => {
    // Skip if we're already reconnecting
    if (isReconnectingRef.current) return;
    
    // Check if this error is related to known problematic listings
    for (const listingId of PROBLEMATIC_LISTING_IDS) {
      if (errorMessage.includes(listingId)) {
        console.log(`[ConnectionHandler] Ignoring error related to known problematic listing: ${listingId}`);
        return; // Skip processing this error
      }
    }
    
    const now = Date.now();
    const tracker = errorTracker.current;
    
    // Check if this is a new unique error in this session
    if (!tracker.errors.has(errorMessage)) {
      console.log('[ConnectionHandler] New Firebase-related error:', errorMessage);
      tracker.errors.add(errorMessage);
    }
    
    // Update error count with rate limiting
    const timeSinceLastError = now - tracker.lastErrorTime;
    
    // Only count as a new error if it's been at least 2 seconds since the last one
    // This prevents counting the same error multiple times in rapid succession
    if (timeSinceLastError > 2000) {
      tracker.count++;
      tracker.lastErrorTime = now;
      setErrorCount(tracker.count);
      
      // Update UI state
      setConnectionError(true);
      
      // Clear any existing error timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      
      // Show alert after multiple errors to avoid false positives
      if (tracker.count >= 2) {
        setShowAlert(true);
        
        // Auto-attempt reconnection if we're seeing multiple errors
        // and it's been at least 15 seconds since our last attempt
        const timeSinceLastAttempt = now - lastReconnectAttemptRef.current;
        if (tracker.count >= 3 && timeSinceLastAttempt > 15000 && !isReconnectingRef.current) {
          // Schedule reconnection with a short delay to allow batching of errors
          errorTimeoutRef.current = setTimeout(() => {
            attemptReconnection();
          }, 1000);
        }
      }
    }
  }, [attemptReconnection]);

  useEffect(() => {
    // Set up error handling for all pages, but with different sensitivity levels
    const handleCriticalError = (event: ErrorEvent) => {
      // For home page, only handle critical Firebase errors
      if (isHomePage) {
        if (event.message.includes('Firebase: Error') && 
            (event.message.includes('critical') || event.message.includes('not initialized'))) {
          handleFirebaseError(event.message);
        }
      } else {
        // For other pages, handle all Firebase-related errors
        if (event.message.includes('Firebase') || 
            event.message.includes('firestore') || 
            event.message.includes('not initialized')) {
          handleFirebaseError(event.message);
        }
      }
    };
    
    window.addEventListener('error', handleCriticalError);
    
    return () => {
      window.removeEventListener('error', handleCriticalError);
      
      // Clear any pending timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  
    
    // For non-home pages, use the full connection handling
    if (!connectionManager) return;

    // Setup error event listener with improved filtering
    const handleError = (event: ErrorEvent) => {
      // Skip errors from extensions or third-party scripts
      if (event.filename && (
        event.filename.includes('extension://') || 
        event.filename.includes('chrome-extension://') ||
        event.filename.includes('mozilla-extension://')
      )) {
        return;
      }
      
      // Check if the error is related to Firebase/Firestore
      if (
        event.message.includes('firestore') ||
        event.message.includes('firebase') ||
        event.message.includes('Failed to fetch')
      ) {
        handleFirebaseError(event.message);
      }
    };

    // Handle unhandled promise rejections with improved filtering
    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || 'Unknown error';
      
      // Only handle Firebase-related errors
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
      errorTracker.current = {
        count: 0,
        lastErrorTime: 0,
        errors: new Set()
      };
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

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('online', handleOnline);
      removeListener();
      
      // Clear any pending timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [connectionError, handleFirebaseError, attemptReconnection, isHomePage]);

  const handleReconnect = () => {
    attemptReconnection();
  };

  const handleDismiss = () => {
    setShowAlert(false);
    // Reset error count when dismissed
    setErrorCount(0);
    errorTracker.current.count = 0;
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