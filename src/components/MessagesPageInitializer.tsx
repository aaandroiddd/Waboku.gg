import { useEffect, useState, useRef } from 'react';
import { database, getFirebaseServices } from '@/lib/firebase';
import { ref, onValue, get, getDatabase, goOnline, goOffline } from 'firebase/database';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { FirestoreDisabler } from './FirestoreDisabler';

/**
 * This component initializes the messages page by ensuring that:
 * 1. Firestore is disabled for the messages page (we only use Realtime Database)
 * 2. Realtime Database connection is verified and established
 * 3. Provides recovery mechanisms for connection issues
 * 4. Optimizes database connection for better performance
 */
export function MessagesPageInitializer() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const { toast } = useToast();
  const router = useRouter();
  const dbInstanceRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    
    // First try to use the cached database instance
    let db = dbInstanceRef.current || database;
    
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
    
    // Cache the database instance
    if (db) {
      dbInstanceRef.current = db;
    }
    
    if (!db) {
      console.error('[MessagesPageInitializer] Failed to get database instance after all attempts');
      setConnectionStatus('disconnected');
      
      // Connection alerts have been disabled as requested
      // Still log the error for debugging purposes
      console.log('[MessagesPageInitializer] Database connection failed after multiple attempts');
      
      // Retry with exponential backoff if we haven't tried too many times
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        console.log(`[MessagesPageInitializer] Retrying in ${delay}ms`);
        timeoutRef.current = setTimeout(() => verifyDatabaseConnection(retryCount + 1), delay);
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
          timeoutRef.current = setTimeout(() => verifyDatabaseConnection(retryCount + 1), delay);
        } else {
          // Connection alerts have been disabled as requested
          console.log('[MessagesPageInitializer] Connection lost after multiple retry attempts');
        }
      }, { onlyOnce: true });
      
      // Store the unsubscribe function
      unsubscribeRef.current = unsubscribe;
      
      // If we're still checking after 5 seconds, assume disconnected
      timeoutRef.current = setTimeout(() => {
        if (connectionStatus === 'checking') {
          console.log('[MessagesPageInitializer] Connection check timed out, assuming disconnected');
          setConnectionStatus('disconnected');
          
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          
          // Retry if we haven't tried too many times
          if (retryCount < 5) {
            verifyDatabaseConnection(retryCount + 1);
          } else {
            // Connection alerts have been disabled as requested
            console.log('[MessagesPageInitializer] Connection check timed out after multiple attempts');
          }
        }
      }, 5000);
    } catch (error) {
      console.error('[MessagesPageInitializer] Error verifying Realtime Database connection:', error);
      setConnectionStatus('disconnected');
      
      // Retry if we haven't tried too many times
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        console.log(`[MessagesPageInitializer] Error during connection check, retrying in ${delay}ms`);
        timeoutRef.current = setTimeout(() => verifyDatabaseConnection(retryCount + 1), delay);
      } else {
        // Connection alerts have been disabled as requested
        console.log('[MessagesPageInitializer] Connection error after multiple retry attempts');
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

    // Listen for visibility changes to optimize connection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MessagesPageInitializer] Page became visible, ensuring connection');
        // Ensure we're online when the page is visible
        if (dbInstanceRef.current) {
          try {
            goOnline(dbInstanceRef.current);
          } catch (error) {
            console.error('[MessagesPageInitializer] Error calling goOnline on visibility change:', error);
          }
        }
        verifyDatabaseConnection(connectionAttempts);
      } else if (document.visibilityState === 'hidden') {
        console.log('[MessagesPageInitializer] Page hidden, connection will be maintained');
        // We keep the connection when hidden to ensure messages are still received
        // This is a change from previous behavior where we would go offline
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
  }, [connectionAttempts]);

  // This component doesn't render anything
  return null;
}