import { getFirebaseServices, removeAllListeners } from '@/lib/firebase';
import { disableNetwork as disableFirestoreNetwork, enableNetwork as enableFirestoreNetwork } from 'firebase/firestore';

/**
 * Fix for client-side Firestore connection issues
 * This addresses common problems with Firestore initialization and connection
 */
export async function fixClientFirestoreConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('[Client Firestore Fix] Starting client-side Firestore connection fix...');
    
    // Step 1: Get Firebase services
    const services = await getFirebaseServices();
    
    if (!services.db) {
      return {
        success: false,
        message: 'Firestore is not initialized',
        details: { error: 'Firestore database instance is null' }
      };
    }
    
    // Step 2: Remove all existing listeners
    const removedListeners = removeAllListeners();
    console.log(`[Client Firestore Fix] Removed ${removedListeners} existing listeners`);
    
    // Step 3: Disable network to reset connections
    try {
      await disableFirestoreNetwork(services.db);
      console.log('[Client Firestore Fix] Firestore network disabled');
    } catch (disableError) {
      console.warn('[Client Firestore Fix] Error disabling network (may already be disabled):', disableError);
    }
    
    // Step 4: Clear browser caches
    await clearClientFirestoreCaches();
    
    // Step 5: Wait before re-enabling
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 6: Re-enable network
    try {
      await enableFirestoreNetwork(services.db);
      console.log('[Client Firestore Fix] Firestore network re-enabled');
    } catch (enableError) {
      console.error('[Client Firestore Fix] Error re-enabling network:', enableError);
      return {
        success: false,
        message: 'Failed to re-enable Firestore network',
        details: { error: enableError instanceof Error ? enableError.message : 'Unknown error' }
      };
    }
    
    // Step 7: Test connection with a simple query
    try {
      const { collection, query, where, limit, getDocs } = await import('firebase/firestore');
      
      const testQuery = query(
        collection(services.db, 'listings'),
        where('status', '==', 'active'),
        limit(1)
      );
      
      const testSnapshot = await getDocs(testQuery);
      console.log(`[Client Firestore Fix] Connection test successful - found ${testSnapshot.size} listings`);
      
      return {
        success: true,
        message: 'Client-side Firestore connection fixed successfully',
        details: {
          removedListeners,
          testQueryResults: testSnapshot.size,
          timestamp: new Date().toISOString()
        }
      };
    } catch (testError) {
      console.error('[Client Firestore Fix] Connection test failed:', testError);
      return {
        success: false,
        message: 'Connection fix completed but test query failed',
        details: { 
          error: testError instanceof Error ? testError.message : 'Unknown error',
          removedListeners
        }
      };
    }
    
  } catch (error) {
    console.error('[Client Firestore Fix] Unexpected error during fix:', error);
    return {
      success: false,
      message: 'Unexpected error during client-side Firestore fix',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Clear client-side Firestore caches
 */
async function clearClientFirestoreCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  console.log('[Client Firestore Fix] Clearing client-side Firestore caches...');
  
  // Clear localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('firestore') || 
        key.includes('firestore') || 
        key.includes('firebase') || 
        key.startsWith('fs_') ||
        key.startsWith('listings_')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[Client Firestore Fix] Cleared ${keysToRemove.length} localStorage items`);
  } catch (localStorageError) {
    console.error('[Client Firestore Fix] Error clearing localStorage:', localStorageError);
  }
  
  // Clear sessionStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.startsWith('firestore') || 
        key.includes('firestore') || 
        key.includes('firebase') || 
        key.startsWith('fs_')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log(`[Client Firestore Fix] Cleared ${keysToRemove.length} sessionStorage items`);
  } catch (sessionStorageError) {
    console.error('[Client Firestore Fix] Error clearing sessionStorage:', sessionStorageError);
  }
  
  // Clear IndexedDB
  try {
    const dbNames = [
      'firestore/[DEFAULT]/main',
      'firestore/[DEFAULT]/metadata',
      'firebase-auth-state'
    ];
    
    const deletePromises = dbNames.map(dbName => {
      return new Promise<void>((resolve) => {
        try {
          const request = window.indexedDB.deleteDatabase(dbName);
          
          request.onsuccess = () => {
            console.log(`[Client Firestore Fix] Successfully deleted IndexedDB: ${dbName}`);
            resolve();
          };
          
          request.onerror = () => {
            console.warn(`[Client Firestore Fix] Error deleting IndexedDB: ${dbName}`);
            resolve(); // Don't fail the entire process
          };
          
          request.onblocked = () => {
            console.warn(`[Client Firestore Fix] Deletion blocked for IndexedDB: ${dbName}`);
            resolve(); // Don't fail the entire process
          };
        } catch (error) {
          console.error(`[Client Firestore Fix] Error setting up IndexedDB deletion for ${dbName}:`, error);
          resolve(); // Don't fail the entire process
        }
      });
    });
    
    await Promise.all(deletePromises);
    console.log('[Client Firestore Fix] IndexedDB cleanup completed');
  } catch (indexedDBError) {
    console.error('[Client Firestore Fix] Error clearing IndexedDB:', indexedDBError);
  }
}

/**
 * Initialize Firestore with better error handling
 */
export async function initializeFirestoreWithRetry(maxRetries = 3): Promise<{
  success: boolean;
  message: string;
  services?: any;
}> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Firestore Init] Attempt ${attempt}/${maxRetries} to initialize Firestore`);
      
      const services = await getFirebaseServices();
      
      if (!services.db) {
        throw new Error('Firestore database instance is null');
      }
      
      // Test the connection with a simple query
      const { collection, query, limit, getDocs } = await import('firebase/firestore');
      
      const testQuery = query(
        collection(services.db, 'listings'),
        limit(1)
      );
      
      await getDocs(testQuery);
      
      console.log(`[Firestore Init] Successfully initialized Firestore on attempt ${attempt}`);
      return {
        success: true,
        message: `Firestore initialized successfully on attempt ${attempt}`,
        services
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`[Firestore Init] Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Wait before retrying, with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[Firestore Init] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try to fix the connection before retrying
        if (attempt === 2) {
          console.log('[Firestore Init] Attempting connection fix before final retry...');
          await fixClientFirestoreConnection();
        }
      }
    }
  }
  
  return {
    success: false,
    message: `Failed to initialize Firestore after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  };
}