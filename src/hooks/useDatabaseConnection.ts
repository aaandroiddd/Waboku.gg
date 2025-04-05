import { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { database as firebaseDatabase } from '@/lib/firebase';

export function useDatabaseConnection() {
  const [database, setDatabase] = useState<ReturnType<typeof getDatabase> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Function to clear Firebase cache and reload
  const clearCacheAndReload = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firebase:previous_websocket_failure');
      localStorage.removeItem('firebase:host:waboku-gg-default-rtdb.firebaseio.com');
      sessionStorage.clear();
      localStorage.setItem('messages_cache_cleared', Date.now().toString());
      window.location.reload();
    }
  }, []);

  // Function to initialize database with retry logic
  const initializeDatabase = useCallback(async () => {
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
    
    try {
      // Try to use the imported database instance first
      let db = firebaseDatabase;
      
      // If that fails, try to initialize directly
      if (!db) {
        try {
          db = getDatabase();
        } catch (directError) {
          console.error('[useDatabaseConnection] Database initialization failed:', directError);
        }
      }
      
      if (!db) {
        // If we've tried too many times, set error state
        if (retryCount >= MAX_RETRIES) {
          setError('Database connection failed. Please try refreshing the page.');
          setConnectionStatus('disconnected');
          return;
        }
        
        // Retry with exponential backoff
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
        timeoutRef.current = setTimeout(initializeDatabase, delay);
        return;
      }
      
      // Successfully got database instance
      setDatabase(db);
      
      // Check connection status
      const connectedRef = ref(db, '.info/connected');
      
      // First try with get() for immediate status
      try {
        const snapshot = await get(connectedRef);
        const connected = snapshot.val();
        
        if (connected) {
          setConnectionStatus('connected');
          setError(null);
          retryCountRef.current = 0;
          return;
        }
      } catch (error) {
        console.error('[useDatabaseConnection] Error checking initial connection:', error);
      }
      
      // Then set up listener for real-time updates
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        setConnectionStatus(connected ? 'connected' : 'disconnected');
        
        if (connected) {
          setError(null);
          retryCountRef.current = 0;
        } else if (retryCount < MAX_RETRIES) {
          // If disconnected and we haven't tried too many times, retry
          retryCountRef.current++;
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          timeoutRef.current = setTimeout(initializeDatabase, delay);
        } else {
          setError('Unable to connect to the database after multiple attempts');
        }
      });
      
      // Store the unsubscribe function
      unsubscribeRef.current = unsubscribe;
      
      // If we're still checking after 5 seconds, retry
      timeoutRef.current = setTimeout(() => {
        if (connectionStatus === 'checking' && retryCount < MAX_RETRIES) {
          retryCountRef.current++;
          initializeDatabase();
        } else if (connectionStatus === 'checking') {
          setConnectionStatus('disconnected');
          setError('Connection timeout. Please check your internet connection.');
        }
      }, 5000);
      
    } catch (err) {
      console.error('[useDatabaseConnection] Error initializing database:', err);
      
      if (retryCount < MAX_RETRIES) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
        timeoutRef.current = setTimeout(initializeDatabase, delay);
      } else {
        setError('Database connection failed. Please try refreshing the page.');
        setConnectionStatus('disconnected');
      }
    }
  }, [connectionStatus]);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase();
    
    // Check if we're coming back from a cache clear
    if (typeof window !== 'undefined') {
      const cacheCleared = localStorage.getItem('messages_cache_cleared');
      if (cacheCleared) {
        localStorage.removeItem('messages_cache_cleared');
        retryCountRef.current = 0;
        setTimeout(initializeDatabase, 1000);
      }
    }
    
    // Listen for online/offline events to trigger reconnection
    const handleOnline = () => {
      retryCountRef.current = 0;
      initializeDatabase();
    };

    const handleOffline = () => {
      setConnectionStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [initializeDatabase]);

  return {
    database,
    connectionStatus,
    error,
    clearCacheAndReload,
    checkConnection: initializeDatabase
  };
}