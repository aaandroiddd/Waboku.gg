import { useEffect, useState } from 'react';
import { database, getFirebaseServices } from '@/lib/firebase';
import { ref, onValue, get, getDatabase } from 'firebase/database';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { FirestoreDisabler } from './FirestoreDisabler';

/**
 * This component initializes the messages page by ensuring that:
 * 1. Firestore is disabled for the messages page (we only use Realtime Database)
 * 2. Realtime Database connection is verified and established
 * 3. Provides recovery mechanisms for connection issues
 */
export function MessagesPageInitializer() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const { toast } = useToast();
  const router = useRouter();

  // Function to clear Firebase cache and reload
  const clearCacheAndReload = () => {
    if (typeof window !== 'undefined') {
      console.log('[MessagesPageInitializer] Clearing Firebase cache and reloading');
      localStorage.removeItem('firebase:previous_websocket_failure');
      localStorage.removeItem('firebase:host:waboku-gg-default-rtdb.firebaseio.com');
      sessionStorage.clear();
      window.location.reload();
    }
  };

  // Function to verify database connection with retry logic
  const verifyDatabaseConnection = async (retryCount = 0) => {
    console.log(`[MessagesPageInitializer] Verifying Realtime Database connection (attempt ${retryCount + 1})`);
    
    // First try to use the imported database instance
    let db = database;
    
    // If that fails, try to get a fresh instance
    if (!db) {
      try {
        console.log('[MessagesPageInitializer] No database instance found, getting fresh instance');
        const { database: freshDb } = getFirebaseServices();
        db = freshDb;
      } catch (error) {
        console.error('[MessagesPageInitializer] Error getting database from services:', error);
      }
    }
    
    // If still no database, try direct initialization
    if (!db) {
      try {
        console.log('[MessagesPageInitializer] Still no database instance, trying direct initialization');
        db = getDatabase();
      } catch (error) {
        console.error('[MessagesPageInitializer] Error initializing database directly:', error);
      }
    }
    
    if (!db) {
      console.error('[MessagesPageInitializer] Failed to get database instance after all attempts');
      setConnectionStatus('disconnected');
      
      // Show toast with recovery option if we've tried multiple times
      if (retryCount >= 2) {
        toast({
          title: "Database Connection Failed",
          description: "Unable to connect to the messaging service. Please try clearing your cache and reloading.",
          action: (
            <Button 
              variant="secondary" 
              onClick={clearCacheAndReload}
            >
              Clear & Reload
            </Button>
          ),
          duration: 10000,
        });
      }
      
      // Retry with exponential backoff if we haven't tried too many times
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        console.log(`[MessagesPageInitializer] Retrying in ${delay}ms`);
        setTimeout(() => verifyDatabaseConnection(retryCount + 1), delay);
      }
      
      return;
    }
    
    try {
      // Check connection status
      const connectedRef = ref(db, '.info/connected');
      
      // First try with get() for immediate status
      try {
        const snapshot = await get(connectedRef);
        const connected = snapshot.val();
        console.log(`[MessagesPageInitializer] Initial connection check: ${connected ? 'connected' : 'disconnected'}`);
        
        if (connected) {
          setConnectionStatus('connected');
          setConnectionAttempts(retryCount);
          return;
        }
      } catch (error) {
        console.error('[MessagesPageInitializer] Error checking initial connection:', error);
      }
      
      // Then set up listener for real-time updates
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        console.log(`[MessagesPageInitializer] Realtime Database connection: ${connected ? 'connected' : 'disconnected'}`);
        
        setConnectionStatus(connected ? 'connected' : 'disconnected');
        
        if (connected) {
          setConnectionAttempts(retryCount);
        } else if (retryCount < 5) {
          // If disconnected and we haven't tried too many times, retry
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          console.log(`[MessagesPageInitializer] Connection lost, retrying in ${delay}ms`);
          setTimeout(() => verifyDatabaseConnection(retryCount + 1), delay);
        } else {
          // If we've tried too many times, show toast with recovery option
          toast({
            title: "Database Connection Failed",
            description: "Unable to connect to the messaging service. Please try clearing your cache and reloading.",
            action: (
              <Button 
                variant="secondary" 
                onClick={clearCacheAndReload}
              >
                Clear & Reload
              </Button>
            ),
            duration: 10000,
          });
        }
      }, { onlyOnce: true });
      
      // If we're still checking after 5 seconds, assume disconnected
      const timeout = setTimeout(() => {
        if (connectionStatus === 'checking') {
          console.log('[MessagesPageInitializer] Connection check timed out, assuming disconnected');
          setConnectionStatus('disconnected');
          unsubscribe();
          
          // Retry if we haven't tried too many times
          if (retryCount < 5) {
            verifyDatabaseConnection(retryCount + 1);
          } else {
            // If we've tried too many times, show toast with recovery option
            toast({
              title: "Database Connection Timeout",
              description: "Connection to the messaging service timed out. Please try clearing your cache and reloading.",
              action: (
                <Button 
                  variant="secondary" 
                  onClick={clearCacheAndReload}
                >
                  Clear & Reload
                </Button>
              ),
              duration: 10000,
            });
          }
        }
      }, 5000);
      
      return () => {
        clearTimeout(timeout);
        unsubscribe();
      };
    } catch (error) {
      console.error('[MessagesPageInitializer] Error verifying Realtime Database connection:', error);
      setConnectionStatus('disconnected');
      
      // Retry if we haven't tried too many times
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        console.log(`[MessagesPageInitializer] Error during connection check, retrying in ${delay}ms`);
        setTimeout(() => verifyDatabaseConnection(retryCount + 1), delay);
      } else {
        // If we've tried too many times, show toast with recovery option
        toast({
          title: "Database Connection Error",
          description: "Error connecting to the messaging service. Please try clearing your cache and reloading.",
          action: (
            <Button 
              variant="secondary" 
              onClick={clearCacheAndReload}
            >
              Clear & Reload
            </Button>
          ),
          duration: 10000,
        });
      }
    }
  };

  useEffect(() => {
    // Run initialization - we now use FirestoreDisabler component instead
    verifyDatabaseConnection();

    // Listen for online/offline events to trigger reconnection
    const handleOnline = () => {
      console.log('[MessagesPageInitializer] Browser went online, verifying connection');
      verifyDatabaseConnection(connectionAttempts);
    };

    const handleOffline = () => {
      console.log('[MessagesPageInitializer] Browser went offline');
      setConnectionStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionAttempts]);

  // This component doesn't render anything
  return null;
}