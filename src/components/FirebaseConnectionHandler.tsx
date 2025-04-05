import { useEffect, useState, useCallback, useRef } from 'react';
import { connectionManager, db, disableNetwork, enableNetwork, firebaseApp, database } from '@/lib/firebase';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';
import { ref, onValue } from 'firebase/database';

// Known problematic listing IDs that should be ignored
const PROBLEMATIC_LISTING_IDS = new Set([
  'CqxNR6z76xXKon3V3BM1',
  'ufKDqtR3DUt2Id2RdLfi'
]);

// Known error patterns that should trigger immediate reconnection
const CRITICAL_ERROR_PATTERNS = [
  'Failed to fetch',
  'firestore.googleapis.com/google.firestore.v1.Firestore/Listen',
  'Firestore/Listen/channel',
  'The operation couldn\'t be completed',
  'network error',
  'Network Error',
  'NetworkError',
  'AbortError',
  'QuotaExceededError',
  'PERMISSION_DENIED',
  'RESOURCE_EXHAUSTED',
  'Bad Request',
  '400 (Bad Request)'
];

export function FirebaseConnectionHandler() {
  const router = useRouter();
  const [connectionError, setConnectionError] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [initializationError, setInitializationError] = useState(false);
  const lastReconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef<boolean>(false);
  const reconnectAttemptCountRef = useRef<number>(0);
  const lastSuccessfulConnectionRef = useRef<number>(Date.now());
  
  // Check if we're on the front page
  const isHomePage = router.pathname === '/';
  
  // Track errors with debouncing to prevent excessive reconnection attempts
  const errorTracker = useRef<{
    count: number;
    lastErrorTime: number;
    errors: Set<string>;
    criticalErrors: number;
  }>({
    count: 0,
    lastErrorTime: 0,
    errors: new Set(),
    criticalErrors: 0
  });

  // Forward declaration for handleListenChannelError
  const handleListenChannelError = useCallback(() => {
    // Implementation will be updated after attemptReconnection is defined
    console.log('[ConnectionHandler] Placeholder for handleListenChannelError');
  }, []);
  
  // More aggressive reconnection strategy with debouncing and circuit breaker pattern
  const attemptReconnection = useCallback(async (forcedReconnect = false) => {
    if (!db || (isReconnectingRef.current && !forcedReconnect)) return;
    
    // Circuit breaker pattern - if we've tried too many times in a short period, back off
    const now = Date.now();
    const timeSinceLastSuccess = now - lastSuccessfulConnectionRef.current;
    
    // If we've been trying for more than 5 minutes with no success and have attempted at least 5 reconnects,
    // implement a longer cooling period
    if (!forcedReconnect && reconnectAttemptCountRef.current >= 5 && timeSinceLastSuccess > 5 * 60 * 1000) {
      console.log('[ConnectionHandler] Circuit breaker activated - too many failed reconnection attempts');
      
      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Schedule a retry after a longer cooling period
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[ConnectionHandler] Circuit breaker reset - attempting reconnection after cooling period');
        reconnectAttemptCountRef.current = 0; // Reset the counter after cooling period
        attemptReconnection(true); // Force reconnect after cooling
      }, 2 * 60 * 1000); // 2 minute cooling period
      
      return;
    }
    
    // Prevent multiple simultaneous reconnection attempts
    isReconnectingRef.current = true;
    setIsReconnecting(true);
    lastReconnectAttemptRef.current = now;
    reconnectAttemptCountRef.current++;
    
    console.log(`[ConnectionHandler] Attempting manual reconnection to Firestore (attempt #${reconnectAttemptCountRef.current})`);
    
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
        errors: new Set(),
        criticalErrors: 0
      };
      
      setConnectionError(false);
      setErrorCount(0);
      setShowAlert(false);
      
      // Mark this as a successful connection
      lastSuccessfulConnectionRef.current = Date.now();
      reconnectAttemptCountRef.current = 0; // Reset attempt counter on success
      
      console.log('[ConnectionHandler] Manual reconnection completed successfully');
      
      // Force a page refresh if we've had multiple critical errors
      // This helps clear any stale state that might be causing persistent issues
      if (errorTracker.current.criticalErrors >= 3 && typeof window !== 'undefined') {
        console.log('[ConnectionHandler] Multiple critical errors detected, refreshing page to clear state');
        window.location.reload();
      }
    } catch (error) {
      console.error('[ConnectionHandler] Error during manual reconnection:', error);
      
      // Schedule another reconnection attempt with exponential backoff
      const backoffDelay = Math.min(5000 * Math.pow(1.5, reconnectAttemptCountRef.current), 60000);
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

  // Update the handleListenChannelError implementation now that attemptReconnection is defined
  const handleListenChannelErrorImpl = useCallback(() => {
    console.log('[ConnectionHandler] Handling specific Firestore Listen channel error');
    
    // Check if we're on the messages page
    const isMessagesPage = router.pathname.includes('/dashboard/messages');
    
    // For messages page, we should be using Realtime Database exclusively
    if (isMessagesPage) {
      console.log('[ConnectionHandler] Detected Firestore Listen error on messages page - we should be using Realtime Database exclusively');
      console.log('[ConnectionHandler] Disabling Firestore and refreshing page to fix connection');
      
      // Immediately show the connection error UI
      setConnectionError(true);
      setShowAlert(true);
      
      // Clear any existing timeouts
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // For messages page, we'll disable Firestore completely and refresh
      errorTimeoutRef.current = setTimeout(async () => {
        try {
          if (db) {
            // Disable Firestore network to prevent further Listen requests
            await disableNetwork(db);
            console.log('[ConnectionHandler] Firestore network disabled for messages page');
            
            // Check if Realtime Database is connected
            if (database) {
              try {
                const connectedRef = ref(database, '.info/connected');
                onValue(connectedRef, (snapshot) => {
                  const connected = snapshot.val();
                  console.log(`[ConnectionHandler] Realtime Database connection: ${connected ? 'connected' : 'disconnected'}`);
                  
                  // If Realtime Database is connected, refresh the page
                  if (connected) {
                    console.log('[ConnectionHandler] Realtime Database is connected, refreshing page');
                    if (typeof window !== 'undefined') {
                      window.location.reload();
                    }
                  } else {
                    console.log('[ConnectionHandler] Realtime Database is not connected, waiting for connection');
                    // Wait for connection before refreshing
                    setTimeout(() => {
                      if (typeof window !== 'undefined') {
                        window.location.reload();
                      }
                    }, 3000);
                  }
                }, { onlyOnce: true });
              } catch (error) {
                console.error('[ConnectionHandler] Error checking Realtime Database connection:', error);
                // Refresh anyway after a delay
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }, 1000);
              }
            } else {
              // No Realtime Database, just refresh
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }, 1000);
            }
          } else {
            // No Firestore, just refresh
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }, 1000);
          }
        } catch (error) {
          console.error('[ConnectionHandler] Error handling Listen channel error:', error);
          // Just refresh the page as a last resort
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }, 1000);
        }
      }, 200);
      
      return;
    }
    
    // For non-messages pages, use the original approach
    // Immediately show the connection error UI
    setConnectionError(true);
    setShowAlert(true);
    
    // Attempt immediate reconnection
    if (!isReconnectingRef.current) {
      console.log('[ConnectionHandler] Initiating immediate reconnection for Listen channel error');
      
      // For this specific error, we'll try a more aggressive approach:
      errorTimeoutRef.current = setTimeout(async () => {
        try {
          // Try to disable and re-enable the network
          if (db) {
            console.log('[ConnectionHandler] Attempting aggressive reconnection for Listen channel error');
            
            // First disable the network
            await disableNetwork(db);
            console.log('[ConnectionHandler] Network disabled for Listen channel error recovery');
            
            // Short delay to ensure disconnection is complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Then re-enable the network
            await enableNetwork(db);
            console.log('[ConnectionHandler] Network re-enabled for Listen channel error recovery');
            
            // If we get here, the reconnection might have worked
            console.log('[ConnectionHandler] Aggressive reconnection completed, monitoring for success');
            
            // For 400 Bad Request errors, we need a more aggressive approach - refresh the page
            // This is likely due to an invalid session or token that needs to be reset
            if (errorTracker.current.errors.has('400 (Bad Request)') || 
                Array.from(errorTracker.current.errors).some(err => err.includes('Bad Request'))) {
              console.log('[ConnectionHandler] 400 Bad Request detected, refreshing page to reset session');
              
              // Short delay before refresh to allow logging to complete
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }, 1000);
              return;
            }
            
            // If we still see errors after a short period, try a page refresh
            setTimeout(() => {
              if (errorTracker.current.count > 0 && typeof window !== 'undefined') {
                console.log('[ConnectionHandler] Errors persist after reconnection attempt, refreshing page');
                window.location.reload();
              }
            }, 5000);
          } else {
            // Fallback to normal reconnection if db is not available
            attemptReconnection(true);
          }
        } catch (error) {
          console.error('[ConnectionHandler] Error during aggressive reconnection:', error);
          // Fallback to normal reconnection
          attemptReconnection(true);
        }
      }, 200);
    }
  }, [attemptReconnection, db, router.pathname, database]);
  
  // Override the placeholder implementation
  Object.assign(handleListenChannelError, {
    current: handleListenChannelErrorImpl
  });
  
  // Handle errors with improved debouncing and deduplication
  const handleFirebaseError = useCallback((errorMessage: string, stack?: string) => {
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
      if (stack) {
        console.log('[ConnectionHandler] Error stack:', stack);
      }
      tracker.errors.add(errorMessage);
    }
    
    // Special handling for "Failed to fetch" errors related to Firestore Listen channel
    if ((errorMessage.includes('Failed to fetch') || (stack && stack.includes('Failed to fetch'))) &&
        (stack && (stack.includes('firestore.googleapis.com/google.firestore.v1.Firestore/Listen') || 
                  stack.includes('Firestore/Listen/channel')))) {
      console.log('[ConnectionHandler] Detected Firestore Listen channel fetch error - prioritizing reconnection');
      // This is the specific error we're seeing in the user reports
      tracker.criticalErrors += 2; // Count this as multiple critical errors to escalate priority
      
      // Use our specialized handler for this specific error
      handleListenChannelErrorImpl();
      
      return; // Skip normal processing for this specific error
    }
    
    // Check if this is a critical error that should trigger immediate reconnection
    let isCriticalError = false;
    for (const pattern of CRITICAL_ERROR_PATTERNS) {
      if (errorMessage.includes(pattern) || (stack && stack.includes(pattern))) {
        isCriticalError = true;
        tracker.criticalErrors++;
        console.log(`[ConnectionHandler] Critical error detected: ${pattern}`);
        break;
      }
    }
    
    // Update error count with rate limiting
    const timeSinceLastError = now - tracker.lastErrorTime;
    
    // Only count as a new error if it's been at least 2 seconds since the last one
    // This prevents counting the same error multiple times in rapid succession
    if (timeSinceLastError > 2000 || isCriticalError) {
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
      // Critical errors show alert immediately
      if (tracker.count >= 2 || isCriticalError) {
        setShowAlert(true);
        
        // Auto-attempt reconnection if we're seeing multiple errors
        // and it's been at least 15 seconds since our last attempt
        // Critical errors trigger immediate reconnection
        const timeSinceLastAttempt = now - lastReconnectAttemptRef.current;
        if ((tracker.count >= 3 && timeSinceLastAttempt > 15000) || 
            (isCriticalError && timeSinceLastAttempt > 5000)) {
          
          // Schedule reconnection with a short delay to allow batching of errors
          // Critical errors get a shorter delay
          const reconnectDelay = isCriticalError ? 500 : 1000;
          
          errorTimeoutRef.current = setTimeout(() => {
            attemptReconnection(isCriticalError);
          }, reconnectDelay);
        }
      }
    }
  }, [attemptReconnection, handleListenChannelError]);

  useEffect(() => {
    // Set up error handling for all pages, but with different sensitivity levels
    const handleCriticalError = (event: ErrorEvent) => {
      // For home page, only handle critical Firebase errors
      if (isHomePage) {
        if (event.message.includes('Firebase: Error') && 
            (event.message.includes('critical') || event.message.includes('not initialized'))) {
          handleFirebaseError(event.message, event.error?.stack);
        }
      } else {
        // For other pages, handle all Firebase-related errors
        if (event.message.includes('Firebase') || 
            event.message.includes('firestore') || 
            event.message.includes('not initialized')) {
          handleFirebaseError(event.message, event.error?.stack);
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
  }, [handleFirebaseError, isHomePage]);

  useEffect(() => {
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
      
      // Special handling for "Failed to fetch" errors
      if (event.message.includes('Failed to fetch')) {
        // Check if the stack trace contains Firestore Listen channel references
        if (event.error?.stack && (
          event.error.stack.includes('firestore.googleapis.com/google.firestore.v1.Firestore/Listen') ||
          event.error.stack.includes('Firestore/Listen/channel')
        )) {
          console.log('[ConnectionHandler] Detected specific Firestore Listen channel fetch error');
          // Use our specialized handler for this specific error
          handleListenChannelErrorImpl();
          return;
        }
      }
      
      // Check if the error is related to Firebase/Firestore
      if (
        event.message.includes('firestore') ||
        event.message.includes('firebase') ||
        event.message.includes('Failed to fetch')
      ) {
        handleFirebaseError(event.message, event.error?.stack);
      }
    };

    // Handle unhandled promise rejections with improved filtering
    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || 'Unknown error';
      const errorStack = event.reason?.stack || '';
      
      // Special handling for "Failed to fetch" errors in promise rejections
      if (errorMessage.includes('Failed to fetch') || errorStack.includes('Failed to fetch')) {
        // Check if the stack trace contains Firestore Listen channel references
        if (errorStack.includes('firestore.googleapis.com/google.firestore.v1.Firestore/Listen') ||
            errorStack.includes('Firestore/Listen/channel')) {
          console.log('[ConnectionHandler] Detected specific Firestore Listen channel fetch error in promise rejection');
          // Use our specialized handler for this specific error
          handleListenChannelErrorImpl();
          return;
        }
      }
      
      // Only handle Firebase-related errors
      if (
        errorMessage.includes('firestore') ||
        errorMessage.includes('firebase') ||
        errorMessage.includes('Failed to fetch') ||
        errorStack.includes('firestore') ||
        errorStack.includes('firebase') ||
        errorStack.includes('Failed to fetch')
      ) {
        handleFirebaseError(errorMessage, errorStack);
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
        errors: new Set(),
        criticalErrors: 0
      };
      
      // Mark successful connection
      lastSuccessfulConnectionRef.current = Date.now();
      reconnectAttemptCountRef.current = 0;
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
    
    // Set up a periodic connection check
    const connectionCheckInterval = setInterval(() => {
      // Only check if we're not already reconnecting and we have errors
      if (!isReconnectingRef.current && errorTracker.current.count > 0) {
        const now = Date.now();
        const timeSinceLastAttempt = now - lastReconnectAttemptRef.current;
        
        // If it's been more than 30 seconds since our last attempt, try again
        if (timeSinceLastAttempt > 30000) {
          console.log('[ConnectionHandler] Periodic connection check - attempting reconnection');
          attemptReconnection();
        }
      }
    }, 30000); // Check every 30 seconds

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('online', handleOnline);
      removeListener();
      
      // Clear any pending timeouts and intervals
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      clearInterval(connectionCheckInterval);
    };
  }, [connectionError, handleFirebaseError, attemptReconnection, handleListenChannelError]);

  const handleReconnect = () => {
    attemptReconnection(true); // Force reconnection when user clicks the button
  };

  const handleDismiss = () => {
    setShowAlert(false);
    // Reset error count when dismissed
    setErrorCount(0);
    errorTracker.current.count = 0;
  };

  // Only render if there's a connection error and we should show the alert
  if (!showAlert) return null;

  // Connection alerts have been disabled as requested
  return null;
}