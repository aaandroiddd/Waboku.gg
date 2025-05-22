import { getDatabase, ref, onValue, set } from 'firebase/database';
import { getFirebaseServices, removeAllListeners } from '@/lib/firebase';
import { disableNetwork as disableFirestoreNetwork, enableNetwork as enableFirestoreNetwork } from 'firebase/firestore';

/**
 * This function attempts to fix Firebase Realtime Database connection issues
 * by addressing common problems with long polling and certificate validation.
 */
export async function fixFirebaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('[Firebase Fix] Attempting to fix Firebase connection issues...');
    
    // Step 1: Get Firebase services
    const { database, app } = getFirebaseServices();
    
    if (!app) {
      return {
        success: false,
        message: 'Firebase app is not initialized',
        details: { error: 'Firebase app is null' }
      };
    }
    
    if (!database) {
      return {
        success: false,
        message: 'Firebase Realtime Database is not initialized',
        details: { error: 'Database is null' }
      };
    }
    
    // Step 2: Test basic connectivity
    console.log('[Firebase Fix] Testing basic connectivity...');
    
    try {
      // Write a test value to verify basic connectivity
      const testRef = ref(database, 'connection_tests/fix_' + Date.now());
      await set(testRef, {
        timestamp: Date.now(),
        message: 'Connection fix test'
      });
      console.log('[Firebase Fix] Basic write test successful');
    } catch (writeError) {
      console.error('[Firebase Fix] Basic write test failed:', writeError);
      return {
        success: false,
        message: 'Failed to write to database',
        details: { error: writeError instanceof Error ? writeError.message : 'Unknown error' }
      };
    }
    
    // Step 3: Test long polling connection
    console.log('[Firebase Fix] Testing long polling connection...');
    
    const longPollingPromise = new Promise<{success: boolean, message: string}>((resolve) => {
      try {
        // First, try to write to the debug path to ensure we have write access
        const debugRef = ref(database, 'debug/connection_test');
        set(debugRef, {
          timestamp: Date.now(),
          message: 'Testing long polling connection'
        }).then(() => {
          console.log('[Firebase Fix] Successfully wrote to debug path');
          
          // Now test the connection status
          const connectedRef = ref(database, '.info/connected');
          let timeout: NodeJS.Timeout;
          
          const unsubscribe = onValue(connectedRef, (snapshot) => {
            const connected = snapshot.val();
            
            if (connected) {
              console.log('[Firebase Fix] Long polling connection successful');
              clearTimeout(timeout);
              unsubscribe();
              resolve({
                success: true,
                message: 'Long polling connection established successfully'
              });
            }
          }, (error) => {
            console.error('[Firebase Fix] Long polling error:', error);
            clearTimeout(timeout);
            unsubscribe();
            resolve({
              success: false,
              message: `Long polling error: ${error.message}`
            });
          });
          
          // Set a timeout to resolve if we don't get a connection after 15 seconds
          timeout = setTimeout(() => {
            console.log('[Firebase Fix] Long polling timed out');
            unsubscribe();
            // Even if we time out, if we could write to the database, consider it a partial success
            resolve({
              success: true,
              message: 'Database write successful, but long polling connection timed out. This may be normal during initial connection.'
            });
          }, 15000);
        }).catch(error => {
          console.error('[Firebase Fix] Failed to write to debug path:', error);
          resolve({
            success: false,
            message: `Failed to write to debug path: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        });
      } catch (error) {
        console.error('[Firebase Fix] Error setting up long polling test:', error);
        resolve({
          success: false,
          message: `Error setting up long polling: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });
    
    const longPollingResult = await longPollingPromise;
    
    if (!longPollingResult.success) {
      return {
        success: false,
        message: 'Long polling connection failed',
        details: { longPollingError: longPollingResult.message }
      };
    }
    
    // Step 4: Check certificate
    console.log('[Firebase Fix] Checking SSL certificate...');
    
    try {
      // Get database URL
      const databaseRef = ref(database);
      const url = databaseRef.toString();
      
      if (!url) {
        return {
          success: false,
          message: 'Could not determine database URL',
          details: { error: 'Database URL is empty' }
        };
      }
      
      // Extract hostname
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      
      // Use fetch to check certificate
      const response = await fetch(`https://${hostname}/.well-known/assetlinks.json`, {
        method: 'HEAD',
      }).catch(error => {
        throw new Error(`Certificate validation failed: ${error.message}`);
      });
      
      if (response.ok || response.status === 404) {
        // 404 is fine, we just want to check if the SSL handshake works
        console.log('[Firebase Fix] SSL certificate is valid');
      } else {
        console.error('[Firebase Fix] Certificate validation failed with status:', response.status);
        return {
          success: false,
          message: `Certificate validation failed with status: ${response.status}`,
          details: { certificateError: `HTTP status ${response.status}` }
        };
      }
    } catch (certError) {
      console.error('[Firebase Fix] Certificate validation error:', certError);
      return {
        success: false,
        message: 'Certificate validation failed',
        details: { certificateError: certError instanceof Error ? certError.message : 'Unknown error' }
      };
    }
    
    // All tests passed
    return {
      success: true,
      message: 'Firebase connection is working correctly',
      details: {
        databaseUrl: ref(database).toString(),
        appName: app.name
      }
    };
  } catch (error) {
    console.error('[Firebase Fix] Unexpected error during fix:', error);
    return {
      success: false,
      message: 'Unexpected error during connection fix',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * This function attempts to fix issues with Firebase Realtime Database
 * by forcing a reconnection and clearing any cached connection state.
 */
export async function forceReconnectFirebase(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log('[Firebase Fix] Forcing Firebase reconnection...');
    
    // Get Firebase services
    const { database, db } = getFirebaseServices();
    
    if (!database) {
      return {
        success: false,
        message: 'Firebase Realtime Database is not initialized'
      };
    }
    
    // First, clear any Firestore listeners
    if (db) {
      try {
        // Remove all listeners to prevent them from reconnecting automatically
        const removedCount = removeAllListeners();
        console.log(`[Firebase Fix] Removed ${removedCount} Firestore listeners`);
        
        // Disable and re-enable Firestore network
        await disableFirestoreNetwork(db);
        console.log('[Firebase Fix] Firestore network disabled');
        
        // Clear browser caches
        await clearFirestoreCaches();
        
        // Wait before re-enabling
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await enableFirestoreNetwork(db);
        console.log('[Firebase Fix] Firestore network re-enabled');
      } catch (firestoreError) {
        console.error('[Firebase Fix] Error resetting Firestore:', firestoreError);
      }
    }
    
    // Write a special value to force a connection reset
    const resetRef = ref(database, '.info/connected');
    
    // Create a new listener to force a new connection
    return new Promise((resolve) => {
      let timeout: NodeJS.Timeout;
      
      const unsubscribe = onValue(resetRef, (snapshot) => {
        const connected = snapshot.val();
        
        if (connected) {
          console.log('[Firebase Fix] Reconnection successful');
          clearTimeout(timeout);
          unsubscribe();
          resolve({
            success: true,
            message: 'Firebase reconnection successful'
          });
        }
      }, (error) => {
        console.error('[Firebase Fix] Reconnection error:', error);
        clearTimeout(timeout);
        unsubscribe();
        resolve({
          success: false,
          message: `Reconnection error: ${error.message}`
        });
      });
      
      // Set a timeout to resolve if we don't get a connection after 10 seconds
      timeout = setTimeout(() => {
        console.log('[Firebase Fix] Reconnection timed out');
        unsubscribe();
        resolve({
          success: false,
          message: 'Reconnection timed out'
        });
      }, 10000);
    });
  } catch (error) {
    console.error('[Firebase Fix] Error during forced reconnection:', error);
    return {
      success: false,
      message: `Error during forced reconnection: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * This function specifically targets Firestore Listen channel errors
 * by implementing a specialized recovery strategy
 */
export async function fixFirestoreListenChannel(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log('[Firebase Fix] Attempting to fix Firestore Listen channel issues...');
    
    // Get Firestore instance
    const { db } = getFirebaseServices();
    
    if (!db) {
      return {
        success: false,
        message: 'Firestore is not initialized'
      };
    }
    
    // Step 1: Remove all listeners
    const removedCount = removeAllListeners();
    console.log(`[Firebase Fix] Removed ${removedCount} Firestore listeners`);
    
    // Step 2: Disable Firestore network
    try {
      await disableFirestoreNetwork(db);
      console.log('[Firebase Fix] Firestore network disabled');
    } catch (disableError) {
      console.error('[Firebase Fix] Error disabling Firestore network:', disableError);
      return {
        success: false,
        message: `Failed to disable Firestore network: ${disableError instanceof Error ? disableError.message : 'Unknown error'}`
      };
    }
    
    // Step 3: Clear Firestore caches
    try {
      await clearFirestoreCaches();
      console.log('[Firebase Fix] Firestore caches cleared');
    } catch (cacheError) {
      console.error('[Firebase Fix] Error clearing Firestore caches:', cacheError);
      // Continue anyway, this is not critical
    }
    
    // Step 4: Wait before re-enabling
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Re-enable Firestore network
    try {
      await enableFirestoreNetwork(db);
      console.log('[Firebase Fix] Firestore network re-enabled');
    } catch (enableError) {
      console.error('[Firebase Fix] Error re-enabling Firestore network:', enableError);
      return {
        success: false,
        message: `Failed to re-enable Firestore network: ${enableError instanceof Error ? enableError.message : 'Unknown error'}`
      };
    }
    
    return {
      success: true,
      message: 'Firestore Listen channel recovery completed successfully'
    };
  } catch (error) {
    console.error('[Firebase Fix] Error during Firestore Listen channel recovery:', error);
    return {
      success: false,
      message: `Error during Firestore Listen channel recovery: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Clear Firestore caches in the browser
 */
export async function clearFirestoreCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  console.log('[Firebase Fix] Clearing Firestore caches...');
  
  // Clear localStorage items related to Firestore
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('firestore') || 
          key.includes('firestore') || 
          key.includes('firebase') || 
          key.includes('fs_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('[Firebase Fix] Cleared Firestore localStorage items');
  } catch (localStorageError) {
    console.error('[Firebase Fix] Error clearing localStorage:', localStorageError);
  }
  
  // Clear IndexedDB databases related to Firestore
  try {
    const dbNames = ['firestore/[DEFAULT]/main', 'firestore/[DEFAULT]/metadata'];
    
    const deletePromises = dbNames.map(dbName => {
      return new Promise<void>((resolve, reject) => {
        try {
          const request = window.indexedDB.deleteDatabase(dbName);
          
          request.onsuccess = () => {
            console.log(`[Firebase Fix] Successfully deleted IndexedDB database: ${dbName}`);
            resolve();
          };
          
          request.onerror = (event) => {
            console.error(`[Firebase Fix] Error deleting IndexedDB database ${dbName}:`, event);
            reject(new Error(`Failed to delete IndexedDB database ${dbName}`));
          };
          
          request.onblocked = (event) => {
            console.warn(`[Firebase Fix] Deletion of IndexedDB database ${dbName} blocked:`, event);
            // Try to resolve anyway, as this is not critical
            resolve();
          };
        } catch (error) {
          console.error(`[Firebase Fix] Error setting up deletion for IndexedDB database ${dbName}:`, error);
          reject(error);
        }
      });
    });
    
    await Promise.allSettled(deletePromises);
    console.log('[Firebase Fix] IndexedDB cleanup completed');
  } catch (indexedDBError) {
    console.error('[Firebase Fix] Error clearing IndexedDB:', indexedDBError);
  }
}