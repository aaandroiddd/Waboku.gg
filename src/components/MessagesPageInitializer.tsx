import { useEffect, useRef, useState } from 'react';
import { database, getFirebaseServices } from '@/lib/firebase';
import { ref, onValue, get, getDatabase, goOnline, set } from 'firebase/database';
import { toast } from '@/components/ui/use-toast';
import { setMessagesPageMode } from '@/hooks/useUserData';

/**
 * This component initializes the messages page by ensuring that:
 * 1. Realtime Database connection is verified and established
 * 2. Optimizes database connection for better performance
 * 3. Provides reliable connection recovery mechanisms
 */
export function MessagesPageInitializer() {
  const dbInstanceRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 8;
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  /**
   * Primary function to establish and verify database connection
   * with improved error handling and recovery
   */
  const connectToDatabase = async (): Promise<any> => {
    try {
      // First try to use existing database instance
      let db = dbInstanceRef.current || database;
      
      // If no database instance exists, get a fresh one
      if (!db) {
        const { database: freshDb } = getFirebaseServices();
        db = freshDb || getDatabase();
        
        if (!db) {
          throw new Error('Failed to initialize database');
        }
      }
      
      // Store the database instance for future use
      dbInstanceRef.current = db;
      
      // Explicitly go online to ensure connection
      goOnline(db);
      
      return db;
    } catch (error) {
      console.error('[MessagesPageInitializer] Database connection error:', error);
      throw error;
    }
  };

  /**
   * Function to verify database connection status
   * with improved error recovery and logging
   */
  const verifyDatabaseConnection = async () => {
    const retryCount = retryCountRef.current;
    
    // Clean up previous connection attempts
    cleanup();
    
    try {
      // Connect to the database
      const db = await connectToDatabase();
      
      // Check connection status via .info/connected reference
      const connectedRef = ref(db, '.info/connected');
      
      // First try with immediate get() for faster response
      try {
        const snapshot = await get(connectedRef);
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[MessagesPageInitializer] Database connection verified');
          setIsConnected(true);
          retryCountRef.current = 0;
          
          // Test write operation
          testDatabaseWrite(db);
          return;
        }
      } catch (error) {
        console.warn('[MessagesPageInitializer] Initial connection check failed:', error);
      }
      
      // Set up listener for connection status changes
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[MessagesPageInitializer] Connection established via listener');
          setIsConnected(true);
          retryCountRef.current = 0;
          
          // Test write operation once connected
          testDatabaseWrite(db);
        } else {
          console.log('[MessagesPageInitializer] Disconnected from database');
          setIsConnected(false);
          
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
            console.log(`[MessagesPageInitializer] Will retry in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            timeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              verifyDatabaseConnection();
            }, delay);
          } else if (retryCount >= MAX_RETRIES) {
            console.error(`[MessagesPageInitializer] Max retry attempts (${MAX_RETRIES}) reached`);
            // Only show a toast on the final attempt to avoid spamming
            toast({
              title: "Connection issues detected",
              description: "Having trouble connecting to the message server. Try refreshing the page.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }
      }, (error) => {
        console.error('[MessagesPageInitializer] Connection listener error:', error);
        setIsConnected(false);
        
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          timeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            verifyDatabaseConnection();
          }, delay);
        }
      });
      
      // Store the unsubscribe function
      unsubscribeRef.current = unsubscribe;
      
      // Set a timeout for initial connection check
      // If we don't get a connection after 5 seconds, retry
      timeoutRef.current = setTimeout(() => {
        if (isConnected !== true && retryCount < MAX_RETRIES) {
          console.log('[MessagesPageInitializer] Connection check timed out');
          retryCountRef.current++;
          verifyDatabaseConnection();
        }
      }, 5000);
      
    } catch (error) {
      console.error('[MessagesPageInitializer] Error during connection verification:', error);
      setIsConnected(false);
      
      // Retry with backoff if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        timeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          verifyDatabaseConnection();
        }, delay);
      }
    }
  };

  /**
   * Test database connection by writing to a test node
   * This confirms write permissions are working correctly
   */
  const testDatabaseWrite = async (db: any) => {
    try {
      if (!db) return;
      
      const testRef = ref(db, 'connection_tests/last_test');
      await set(testRef, {
        timestamp: Date.now(),
        client: 'web',
        status: 'connected',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      });
      
      console.log('[MessagesPageInitializer] Test write successful');
    } catch (error) {
      console.error('[MessagesPageInitializer] Test write failed:', error);
      
      // If write fails but read succeeded, we might have permission issues
      toast({
        title: "Permission Issue Detected",
        description: "Unable to send messages. Please refresh the page or contact support.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  /**
   * Cleanup function to clear timeouts and unsubscribe from listeners
   */
  const cleanup = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  useEffect(() => {
    // Run initialization on component mount
    console.log('[MessagesPageInitializer] Initializing messages page');
    
    // Set messages page mode to true to prioritize RTDB over Firestore
    setMessagesPageMode(true);
    
    verifyDatabaseConnection();

    // Event listeners for online/offline events
    const handleOnline = () => {
      console.log('[MessagesPageInitializer] Browser online event detected');
      toast({
        title: "You're back online",
        description: "Reconnecting to message server...",
        duration: 3000,
      });
      retryCountRef.current = 0;
      verifyDatabaseConnection();
    };

    const handleOffline = () => {
      console.log('[MessagesPageInitializer] Browser offline event detected');
      setIsConnected(false);
      toast({
        title: "You're offline",
        description: "Messages will reconnect when your internet connection returns.",
        variant: "destructive",
        duration: 5000,
      });
    };

    // Visibility change handler to optimize connection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MessagesPageInitializer] Page became visible');
        
        // Re-establish connection when page becomes visible again
        if (dbInstanceRef.current) {
          try {
            goOnline(dbInstanceRef.current);
            console.log('[MessagesPageInitializer] Explicitly going online on visibility change');
            
            // Verify connection status
            verifyDatabaseConnection();
          } catch (error) {
            console.error('[MessagesPageInitializer] Error going online on visibility change:', error);
          }
        }
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
      
      // Reset messages page mode when component unmounts
      setMessagesPageMode(false);
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}
