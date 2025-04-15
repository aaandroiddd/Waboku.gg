import { useEffect, useRef } from 'react';
import { database, getFirebaseServices } from '@/lib/firebase';
import { ref, onValue, get, getDatabase, goOnline, set } from 'firebase/database';

/**
 * This component initializes the messages page by ensuring that:
 * 1. Realtime Database connection is verified and established
 * 2. Optimizes database connection for better performance
 */
export function MessagesPageInitializer() {
  const dbInstanceRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  // Function to verify database connection with retry logic
  const verifyDatabaseConnection = async () => {
    const retryCount = retryCountRef.current;
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Unsubscribe from previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Get database instance using cached or new instance
    let db = dbInstanceRef.current || database;
    
    if (!db) {
      try {
        const { database: freshDb } = getFirebaseServices();
        db = freshDb || getDatabase();
      } catch (error) {
        console.error('[MessagesPageInitializer] Error getting database:', error);
      }
    }
    
    // Cache the database instance
    if (db) {
      dbInstanceRef.current = db;
    }
    
    if (!db) {
      console.error('[MessagesPageInitializer] Failed to get database instance');
      
      // Retry if we haven't tried too many times
      if (retryCount < MAX_RETRIES) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        timeoutRef.current = setTimeout(verifyDatabaseConnection, delay);
      }
      
      return;
    }
    
    try {
      // Explicitly go online to ensure connection
      try {
        goOnline(db);
      } catch (error) {
        console.error('[MessagesPageInitializer] Error calling goOnline:', error);
      }
      
      // Check connection status
      const connectedRef = ref(db, '.info/connected');
      
      // First try with get() for immediate status
      try {
        const snapshot = await get(connectedRef);
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[MessagesPageInitializer] Database connection verified');
          retryCountRef.current = 0;
          return;
        } else {
          console.log('[MessagesPageInitializer] Not connected, will retry');
        }
      } catch (error) {
        console.error('[MessagesPageInitializer] Error checking initial connection:', error);
      }
      
      // Then set up listener for real-time updates
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[MessagesPageInitializer] Connection established via listener');
          retryCountRef.current = 0;
        } else if (retryCount < MAX_RETRIES) {
          console.log('[MessagesPageInitializer] Still not connected, will retry');
          // If disconnected and we haven't tried too many times, retry
          retryCountRef.current++;
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          timeoutRef.current = setTimeout(verifyDatabaseConnection, delay);
        }
      });
      
      // Store the unsubscribe function
      unsubscribeRef.current = unsubscribe;
      
      // If we're still checking after 5 seconds, retry
      timeoutRef.current = setTimeout(() => {
        if (retryCount < MAX_RETRIES) {
          console.log('[MessagesPageInitializer] Connection check timed out, retrying');
          retryCountRef.current++;
          verifyDatabaseConnection();
        }
      }, 5000);
    } catch (error) {
      console.error('[MessagesPageInitializer] Error verifying connection:', error);
      
      // Retry if we haven't tried too many times
      if (retryCount < MAX_RETRIES) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        timeoutRef.current = setTimeout(verifyDatabaseConnection, delay);
      }
    }
  };

  // Test database connection by writing to a test node
  const testDatabaseWrite = async () => {
    try {
      const db = dbInstanceRef.current;
      if (!db) return;
      
      const testRef = ref(db, 'connection_tests/last_test');
      await set(testRef, {
        timestamp: Date.now(),
        client: 'web',
        status: 'testing'
      });
      
      console.log('[MessagesPageInitializer] Test write successful');
    } catch (error) {
      console.error('[MessagesPageInitializer] Test write failed:', error);
    }
  };

  useEffect(() => {
    // Run initialization
    console.log('[MessagesPageInitializer] Initializing messages page');
    verifyDatabaseConnection();

    // Listen for online/offline events to trigger reconnection
    const handleOnline = () => {
      console.log('[MessagesPageInitializer] Browser online event detected');
      retryCountRef.current = 0;
      verifyDatabaseConnection();
    };

    const handleOffline = () => {
      console.log('[MessagesPageInitializer] Browser offline event detected');
    };

    // Listen for visibility changes to optimize connection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MessagesPageInitializer] Page became visible');
        // Ensure we're online when the page is visible
        if (dbInstanceRef.current) {
          try {
            goOnline(dbInstanceRef.current);
            console.log('[MessagesPageInitializer] Explicitly going online');
          } catch (error) {
            console.error('[MessagesPageInitializer] Error calling goOnline on visibility change:', error);
          }
        }
        verifyDatabaseConnection();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Clean up on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}