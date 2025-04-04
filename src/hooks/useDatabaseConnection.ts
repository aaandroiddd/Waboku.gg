import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { database as firebaseDatabase } from '@/lib/firebase';

export function useDatabaseConnection() {
  const [database, setDatabase] = useState<ReturnType<typeof getDatabase> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Function to clear Firebase cache and reload
  const clearCacheAndReload = useCallback(() => {
    if (typeof window !== 'undefined') {
      console.log('[useDatabaseConnection] Clearing Firebase cache and reloading');
      localStorage.removeItem('firebase:previous_websocket_failure');
      localStorage.removeItem('firebase:host:waboku-gg-default-rtdb.firebaseio.com');
      sessionStorage.clear();
      localStorage.setItem('messages_cache_cleared', Date.now().toString());
      window.location.reload();
    }
  }, []);

  // Function to initialize database with retry logic
  const initializeDatabase = useCallback(async (retryCount = 0) => {
    try {
      console.log(`[useDatabaseConnection] Initializing database (attempt ${retryCount + 1})`);
      
      // First try to use the imported database instance
      if (firebaseDatabase) {
        console.log('[useDatabaseConnection] Using pre-initialized Firebase Realtime Database');
        setDatabase(firebaseDatabase);
        
        // Check connection status
        checkConnectionStatus(firebaseDatabase, retryCount);
        return;
      }
      
      // If that fails, try to initialize directly
      try {
        console.log('[useDatabaseConnection] Attempting direct database initialization');
        const directDb = getDatabase();
        if (directDb) {
          console.log('[useDatabaseConnection] Direct database initialization successful');
          setDatabase(directDb);
          
          // Check connection status
          checkConnectionStatus(directDb, retryCount);
          return;
        }
      } catch (directError) {
        console.error('[useDatabaseConnection] Direct database initialization failed:', directError);
      }
      
      // If we get here, all initialization attempts failed
      console.error('[useDatabaseConnection] Firebase Realtime Database not initialized properly');
      
      // Retry with exponential backoff if we haven't tried too many times
      if (retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
        console.log(`[useDatabaseConnection] Retrying database initialization in ${delay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          initializeDatabase(retryCount + 1);
        }, delay);
        return;
      }
      
      // If we've tried too many times, set error state
      setError('Database connection failed. Please try refreshing the page.');
      setConnectionStatus('disconnected');
    } catch (err) {
      console.error('[useDatabaseConnection] Error initializing database:', err);
      
      // Retry with exponential backoff if we haven't tried too many times
      if (retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
        console.log(`[useDatabaseConnection] Retrying database initialization in ${delay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          initializeDatabase(retryCount + 1);
        }, delay);
        return;
      }
      
      setError('Database connection failed. Please try refreshing the page.');
      setConnectionStatus('disconnected');
    }
  }, []);

  // Function to check connection status
  const checkConnectionStatus = useCallback((db: ReturnType<typeof getDatabase>, retryCount = 0) => {
    try {
      console.log('[useDatabaseConnection] Checking connection status');
      const connectedRef = ref(db, '.info/connected');
      
      // Set up listener for real-time updates
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        console.log(`[useDatabaseConnection] Realtime Database connection: ${connected ? 'connected' : 'disconnected'}`);
        
        setConnectionStatus(connected ? 'connected' : 'disconnected');
        
        if (connected) {
          setError(null);
          setConnectionAttempts(retryCount);
        } else if (retryCount < 5) {
          // If disconnected and we haven't tried too many times, retry
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          console.log(`[useDatabaseConnection] Connection lost, retrying in ${delay}ms`);
          setTimeout(() => initializeDatabase(retryCount + 1), delay);
        } else {
          setError('Unable to connect to the database after multiple attempts');
        }
      });
      
      // If we're still checking after 5 seconds, assume disconnected
      const timeout = setTimeout(() => {
        if (connectionStatus === 'checking') {
          console.log('[useDatabaseConnection] Connection check timed out, assuming disconnected');
          setConnectionStatus('disconnected');
          setError('Connection timeout. Please check your internet connection.');
          unsubscribe();
          
          // Retry if we haven't tried too many times
          if (retryCount < 5) {
            initializeDatabase(retryCount + 1);
          }
        }
      }, 5000);
      
      return () => {
        clearTimeout(timeout);
        unsubscribe();
      };
    } catch (error) {
      console.error('[useDatabaseConnection] Error checking connection status:', error);
      setConnectionStatus('disconnected');
      setError('Error checking connection status');
      
      // Retry if we haven't tried too many times
      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
        setTimeout(() => initializeDatabase(retryCount + 1), delay);
      }
    }
  }, [connectionStatus, initializeDatabase]);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
    
    // Check if we're coming back from a cache clear
    if (typeof window !== 'undefined') {
      const cacheCleared = localStorage.getItem('messages_cache_cleared');
      if (cacheCleared) {
        // Remove the flag
        localStorage.removeItem('messages_cache_cleared');
        
        // Log that we're coming back from a cache clear
        console.log('[useDatabaseConnection] Detected return from cache clear, reinitializing database');
        
        // Force a fresh initialization after a short delay
        setTimeout(() => {
          initializeDatabase(0);
        }, 1000);
      }
    }
    
    // Listen for online/offline events to trigger reconnection
    const handleOnline = () => {
      console.log('[useDatabaseConnection] Browser went online, verifying connection');
      initializeDatabase(connectionAttempts);
    };

    const handleOffline = () => {
      console.log('[useDatabaseConnection] Browser went offline');
      setConnectionStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initializeDatabase, connectionAttempts]);

  return {
    database,
    connectionStatus,
    error,
    clearCacheAndReload,
    checkConnection: () => initializeDatabase(connectionAttempts)
  };
}