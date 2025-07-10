/**
 * Firestore Session Manager
 * 
 * This module handles Firestore session management to prevent "Unknown SID" errors
 * that occur when Firestore's persistent connections become stale.
 */

import { 
  getFirestore, 
  disableNetwork, 
  enableNetwork,
  clearIndexedDbPersistence,
  Firestore
} from 'firebase/firestore';
import { getFirebaseServices } from './firebase';

interface SessionState {
  isResetting: boolean;
  lastResetTime: number;
  resetCount: number;
  errorCount: number;
  lastErrorTime: number;
}

class FirestoreSessionManager {
  private sessionState: SessionState = {
    isResetting: false,
    lastResetTime: 0,
    resetCount: 0,
    errorCount: 0,
    lastErrorTime: 0
  };

  private readonly MAX_RESET_ATTEMPTS = 5;
  private readonly RESET_COOLDOWN = 30000; // 30 seconds
  private readonly ERROR_THRESHOLD = 3;
  private readonly ERROR_WINDOW = 60000; // 1 minute

  /**
   * Handle Firestore "Unknown SID" errors
   */
  async handleUnknownSIDError(url: string, status: number): Promise<void> {
    console.warn(`[FirestoreSessionManager] Unknown SID error detected: ${url} (${status})`);
    
    // Track error frequency
    const now = Date.now();
    if (now - this.sessionState.lastErrorTime > this.ERROR_WINDOW) {
      this.sessionState.errorCount = 1;
    } else {
      this.sessionState.errorCount++;
    }
    this.sessionState.lastErrorTime = now;

    // If we're getting too many errors, implement aggressive reset
    if (this.sessionState.errorCount >= this.ERROR_THRESHOLD) {
      console.warn(`[FirestoreSessionManager] Error threshold reached (${this.sessionState.errorCount}), implementing aggressive session reset`);
      await this.aggressiveSessionReset();
    } else {
      // Standard session reset
      await this.resetFirestoreSession();
    }
  }

  /**
   * Reset Firestore session to clear stale SIDs
   */
  async resetFirestoreSession(): Promise<void> {
    if (this.sessionState.isResetting) {
      console.log('[FirestoreSessionManager] Session reset already in progress');
      return;
    }

    const now = Date.now();
    if (now - this.sessionState.lastResetTime < this.RESET_COOLDOWN) {
      console.log('[FirestoreSessionManager] Session reset on cooldown');
      return;
    }

    if (this.sessionState.resetCount >= this.MAX_RESET_ATTEMPTS) {
      console.warn('[FirestoreSessionManager] Maximum reset attempts reached');
      return;
    }

    this.sessionState.isResetting = true;
    this.sessionState.lastResetTime = now;
    this.sessionState.resetCount++;

    try {
      console.log(`[FirestoreSessionManager] Starting session reset (attempt ${this.sessionState.resetCount})`);
      
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firestore not available');
      }

      // Step 1: Disable network to close all connections
      await disableNetwork(db);
      console.log('[FirestoreSessionManager] Firestore network disabled');

      // Step 2: Clear browser caches that might contain stale session data
      await this.clearFirestoreCaches();

      // Step 3: Wait for connections to fully close
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 4: Re-enable network to establish fresh connections
      await enableNetwork(db);
      console.log('[FirestoreSessionManager] Firestore network re-enabled with fresh session');

      // Reset error count on successful reset
      this.sessionState.errorCount = 0;
      
    } catch (error) {
      console.error('[FirestoreSessionManager] Error during session reset:', error);
      throw error;
    } finally {
      this.sessionState.isResetting = false;
    }
  }

  /**
   * Aggressive session reset for persistent issues
   */
  async aggressiveSessionReset(): Promise<void> {
    if (this.sessionState.isResetting) {
      console.log('[FirestoreSessionManager] Aggressive reset already in progress');
      return;
    }

    this.sessionState.isResetting = true;

    try {
      console.log('[FirestoreSessionManager] Starting aggressive session reset');
      
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firestore not available');
      }

      // Step 1: Disable network
      await disableNetwork(db);
      console.log('[FirestoreSessionManager] Network disabled for aggressive reset');

      // Step 2: Clear all Firestore-related storage
      await this.clearAllFirestoreStorage();

      // Step 3: Clear IndexedDB persistence
      try {
        await clearIndexedDbPersistence(db);
        console.log('[FirestoreSessionManager] Cleared IndexedDB persistence');
      } catch (error) {
        console.warn('[FirestoreSessionManager] Could not clear IndexedDB persistence:', error);
      }

      // Step 4: Extended wait for complete cleanup
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Step 5: Re-enable network
      await enableNetwork(db);
      console.log('[FirestoreSessionManager] Network re-enabled after aggressive reset');

      // Reset all counters
      this.sessionState.errorCount = 0;
      this.sessionState.resetCount = 0;
      
    } catch (error) {
      console.error('[FirestoreSessionManager] Error during aggressive session reset:', error);
      throw error;
    } finally {
      this.sessionState.isResetting = false;
    }
  }

  /**
   * Clear Firestore-related browser caches
   */
  private async clearFirestoreCaches(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Clear localStorage items related to Firestore
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('firestore') || 
        key.includes('firebase') ||
        key.startsWith('fs_') ||
        key.includes('listen_') ||
        key.includes('channel_')
      );

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      // Clear sessionStorage items
      const sessionKeysToRemove = Object.keys(sessionStorage).filter(key => 
        key.includes('firestore') || 
        key.includes('firebase') ||
        key.startsWith('fs_')
      );

      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });

      console.log(`[FirestoreSessionManager] Cleared ${keysToRemove.length + sessionKeysToRemove.length} cache entries`);
    } catch (error) {
      console.error('[FirestoreSessionManager] Error clearing caches:', error);
    }
  }

  /**
   * Clear all Firestore-related storage for aggressive reset
   */
  private async clearAllFirestoreStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Clear all localStorage (aggressive approach)
      const allLocalStorageKeys = Object.keys(localStorage);
      allLocalStorageKeys.forEach(key => {
        if (key.includes('firestore') || 
            key.includes('firebase') ||
            key.includes('google') ||
            key.includes('gapi') ||
            key.startsWith('fs_') ||
            key.startsWith('waboku_signout') ||
            key.includes('auth') ||
            key.includes('session') ||
            key.includes('token')) {
          localStorage.removeItem(key);
        }
      });

      // Clear all sessionStorage
      sessionStorage.clear();

      // Clear IndexedDB databases related to Firestore
      const dbNames = [
        'firestore/[DEFAULT]/main',
        'firestore/[DEFAULT]/metadata',
        'firebase-auth-state',
        'firebase-messaging-database'
      ];

      for (const dbName of dbNames) {
        try {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve(undefined);
            deleteRequest.onerror = () => reject(deleteRequest.error);
            deleteRequest.onblocked = () => {
              console.warn(`[FirestoreSessionManager] IndexedDB deletion blocked for ${dbName}`);
              resolve(undefined);
            };
          });
          console.log(`[FirestoreSessionManager] Deleted IndexedDB: ${dbName}`);
        } catch (error) {
          console.warn(`[FirestoreSessionManager] Could not delete IndexedDB ${dbName}:`, error);
        }
      }

      // Clear service worker caches if available
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          const firebaseCaches = cacheNames.filter(name => 
            name.includes('firebase') || name.includes('firestore')
          );
          
          await Promise.all(firebaseCaches.map(name => caches.delete(name)));
          console.log(`[FirestoreSessionManager] Cleared ${firebaseCaches.length} service worker caches`);
        } catch (error) {
          console.warn('[FirestoreSessionManager] Error clearing service worker caches:', error);
        }
      }

      console.log('[FirestoreSessionManager] Completed aggressive storage cleanup');
    } catch (error) {
      console.error('[FirestoreSessionManager] Error during aggressive storage cleanup:', error);
    }
  }

  /**
   * Check if a URL indicates a Firestore session error
   */
  isFirestoreSessionError(url: string, status: number): boolean {
    return (
      url.includes('firestore.googleapis.com') &&
      (url.includes('/Listen/channel') || url.includes('/Write/channel')) &&
      status === 400
    );
  }

  /**
   * Get current session state for debugging
   */
  getSessionState(): SessionState {
    return { ...this.sessionState };
  }

  /**
   * Reset session state counters
   */
  resetSessionState(): void {
    this.sessionState = {
      isResetting: false,
      lastResetTime: 0,
      resetCount: 0,
      errorCount: 0,
      lastErrorTime: 0
    };
    console.log('[FirestoreSessionManager] Session state reset');
  }
}

// Create singleton instance
export const firestoreSessionManager = new FirestoreSessionManager();

/**
 * Initialize Firestore session management
 * This should be called early in the application lifecycle
 */
export function initializeFirestoreSessionManagement(): void {
  if (typeof window === 'undefined') return;

  console.log('[FirestoreSessionManager] Initializing session management');

  // Override fetch to intercept Firestore errors
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : input.toString();

      // Check for Firestore session errors
      if (firestoreSessionManager.isFirestoreSessionError(url, response.status)) {
        console.error(`[FirestoreSessionManager] Detected session error: ${url} (${response.status})`);
        
        // Handle the error asynchronously to not block the original request
        setTimeout(() => {
          firestoreSessionManager.handleUnknownSIDError(url, response.status).catch(error => {
            console.error('[FirestoreSessionManager] Error handling session error:', error);
          });
        }, 0);
      }

      return response;
    } catch (error) {
      const url = typeof input === 'string' ? input : input.toString();
      
      // Check for network errors on Firestore URLs
      if (url.includes('firestore.googleapis.com')) {
        console.error(`[FirestoreSessionManager] Network error on Firestore request: ${url}`, error);
        
        // Handle network errors that might be related to session issues
        setTimeout(() => {
          firestoreSessionManager.handleUnknownSIDError(url, 0).catch(sessionError => {
            console.error('[FirestoreSessionManager] Error handling network error:', sessionError);
          });
        }, 0);
      }

      throw error;
    }
  };

  // Handle unhandled promise rejections that might be Firestore-related
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason === 'object') {
      const error = event.reason;
      
      // Check for Firestore-related errors
      if (error.message && error.message.includes('firestore')) {
        console.error('[FirestoreSessionManager] Unhandled Firestore error:', error);
        
        // Prevent default handling for known Firestore session errors
        if (error.message.includes('Unknown SID') || 
            error.message.includes('Listen channel') ||
            error.message.includes('Write channel')) {
          event.preventDefault();
          
          // Handle the session error
          setTimeout(() => {
            firestoreSessionManager.resetFirestoreSession().catch(sessionError => {
              console.error('[FirestoreSessionManager] Error handling unhandled rejection:', sessionError);
            });
          }, 0);
        }
      }
    }
  });

  console.log('[FirestoreSessionManager] Session management initialized');
}