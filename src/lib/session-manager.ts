import { getFirebaseServices, connectionManager } from './firebase';
import { disableNetwork, enableNetwork } from 'firebase/firestore';

interface SessionState {
  lastActivity: number;
  sessionId: string | null;
  isValid: boolean;
  errorCount: number;
  lastErrorTime: number;
}

class FirebaseSessionManager {
  private sessionState: SessionState = {
    lastActivity: Date.now(),
    sessionId: null,
    isValid: true,
    errorCount: 0,
    lastErrorTime: 0
  };

  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_ERRORS_BEFORE_RESET = 3;
  private readonly ERROR_RESET_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SID_PATTERN = /SID=([^&]+)/;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isResetting = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSessionMonitoring();
      this.setupGlobalErrorHandlers();
    }
  }

  private initializeSessionMonitoring() {
    // Monitor session activity
    this.monitoringInterval = setInterval(() => {
      this.checkSessionHealth();
    }, 60000); // Check every minute

    // Listen for user activity to update last activity time
    const updateActivity = () => {
      this.sessionState.lastActivity = Date.now();
    };

    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.sessionState.lastActivity = Date.now();
        this.checkSessionHealth();
      }
    });
  }

  private setupGlobalErrorHandlers() {
    // Enhanced error handler specifically for session-related errors
    const originalFetch = window.fetch;
    
    window.fetch = async (input, init) => {
      try {
        const response = await originalFetch(input, init);
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';

        // Monitor Firestore requests for session issues
        if (url.includes('firestore.googleapis.com')) {
          // Extract session ID from URL if present
          const sidMatch = url.match(this.SID_PATTERN);
          if (sidMatch) {
            this.sessionState.sessionId = sidMatch[1];
          }

          // Handle session-related errors
          if (!response.ok) {
            await this.handleSessionError(response, url);
          } else {
            // Reset error count on successful requests
            this.resetErrorCount();
          }
        }

        return response;
      } catch (error) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        
        if (url.includes('firestore.googleapis.com')) {
          console.error('[Session Manager] Fetch error for Firestore:', error);
          this.incrementErrorCount();
          
          // If we have too many errors, proactively reset session
          if (this.shouldResetSession()) {
            await this.resetSession('fetch_errors');
          }
        }

        throw error;
      }
    };

    // Handle unhandled rejections that might be session-related
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isSessionRelatedError(event.reason)) {
        console.log('[Session Manager] Detected session-related unhandled rejection');
        event.preventDefault(); // Prevent default error handling
        this.handleSessionError(null, 'unhandled_rejection');
      }
    });
  }

  private isSessionRelatedError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || '';
    const stack = error.stack || '';
    
    return (
      message.includes('Unknown SID') ||
      message.includes('Bad Request') ||
      stack.includes('firestore.googleapis.com') ||
      stack.includes('/Listen/channel') ||
      stack.includes('/Write/channel')
    );
  }

  private async handleSessionError(response: Response | null, url: string) {
    const status = response?.status || 0;
    const now = Date.now();

    console.warn(`[Session Manager] Session error detected: ${status} for ${url}`);

    // Check for specific "Unknown SID" errors
    if (response && status === 400) {
      try {
        const responseText = await response.clone().text();
        if (responseText.includes('Unknown SID')) {
          console.error('[Session Manager] CRITICAL: Unknown SID error detected');
          this.sessionState.isValid = false;
          await this.resetSession('unknown_sid');
          return;
        }
      } catch (readError) {
        console.warn('[Session Manager] Could not read response body:', readError);
      }
    }

    // Increment error count and check if we should reset
    this.incrementErrorCount();
    
    if (this.shouldResetSession()) {
      await this.resetSession('error_threshold');
    }
  }

  private incrementErrorCount() {
    this.sessionState.errorCount++;
    this.sessionState.lastErrorTime = Date.now();
    
    console.log(`[Session Manager] Error count: ${this.sessionState.errorCount}`);
  }

  private resetErrorCount() {
    if (this.sessionState.errorCount > 0) {
      console.log('[Session Manager] Resetting error count after successful request');
      this.sessionState.errorCount = 0;
    }
  }

  private shouldResetSession(): boolean {
    const now = Date.now();
    
    // Reset if we have too many errors
    if (this.sessionState.errorCount >= this.MAX_ERRORS_BEFORE_RESET) {
      return true;
    }

    // Reset if session is marked as invalid
    if (!this.sessionState.isValid) {
      return true;
    }

    // Reset if session has been inactive for too long
    const timeSinceActivity = now - this.sessionState.lastActivity;
    if (timeSinceActivity > this.SESSION_TIMEOUT) {
      console.log('[Session Manager] Session timeout detected');
      return true;
    }

    return false;
  }

  private async resetSession(reason: string) {
    if (this.isResetting) {
      console.log('[Session Manager] Session reset already in progress');
      return;
    }

    this.isResetting = true;
    console.log(`[Session Manager] Resetting session due to: ${reason}`);

    try {
      // Clear session state
      this.sessionState = {
        lastActivity: Date.now(),
        sessionId: null,
        isValid: true,
        errorCount: 0,
        lastErrorTime: 0
      };

      // Use connection manager for reset if available
      if (connectionManager) {
        switch (reason) {
          case 'unknown_sid':
            await connectionManager.forceCompleteSessionReset();
            break;
          case 'error_threshold':
            await connectionManager.forceSessionReset();
            break;
          case 'fetch_errors':
            await connectionManager.handleListenChannelError('session-manager', 0);
            break;
          default:
            await connectionManager.reconnectFirebase();
        }
      } else {
        // Fallback reset without connection manager
        await this.fallbackSessionReset();
      }

      console.log('[Session Manager] Session reset completed successfully');
    } catch (error) {
      console.error('[Session Manager] Session reset failed:', error);
      
      // If session reset fails, force page reload as last resort
      setTimeout(() => {
        console.log('[Session Manager] Forcing page reload due to failed session reset');
        window.location.reload();
      }, 5000);
    } finally {
      this.isResetting = false;
    }
  }

  private async fallbackSessionReset() {
    console.log('[Session Manager] Implementing fallback session reset');
    
    const { db } = getFirebaseServices();
    if (db) {
      try {
        // Disable network
        await disableNetwork(db);
        console.log('[Session Manager] Firestore network disabled');
        
        // Clear browser storage
        this.clearBrowserStorage();
        
        // Wait before re-enabling
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Re-enable network
        await enableNetwork(db);
        console.log('[Session Manager] Firestore network re-enabled');
      } catch (error) {
        console.error('[Session Manager] Fallback session reset failed:', error);
        throw error;
      }
    }
  }

  private clearBrowserStorage() {
    try {
      // Clear Firebase-related localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('firebase') || 
            key.includes('firestore') || 
            key.includes('fs_') ||
            key.includes('gapi') ||
            key.includes('google')) {
          localStorage.removeItem(key);
        }
      });

      // Clear Firebase-related sessionStorage
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('firebase') || 
            key.includes('firestore') || 
            key.includes('fs_')) {
          sessionStorage.removeItem(key);
        }
      });

      // Clear IndexedDB databases
      const dbsToDelete = [
        'firestore/[DEFAULT]/main',
        'firestore/[DEFAULT]/metadata',
        'firebase-auth-state'
      ];

      dbsToDelete.forEach(dbName => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onsuccess = () => {
          console.log(`[Session Manager] Cleared IndexedDB: ${dbName}`);
        };
        deleteRequest.onerror = (event) => {
          console.error(`[Session Manager] Error clearing IndexedDB ${dbName}:`, event);
        };
      });

      console.log('[Session Manager] Browser storage cleared');
    } catch (error) {
      console.error('[Session Manager] Error clearing browser storage:', error);
    }
  }

  private checkSessionHealth() {
    const now = Date.now();
    
    // Check if we should reset due to inactivity
    if (this.shouldResetSession()) {
      this.resetSession('health_check');
      return;
    }

    // Reset error count if enough time has passed since last error
    if (this.sessionState.errorCount > 0 && 
        now - this.sessionState.lastErrorTime > this.ERROR_RESET_INTERVAL) {
      console.log('[Session Manager] Resetting error count due to time elapsed');
      this.sessionState.errorCount = 0;
    }
  }

  // Public methods
  public getSessionState(): Readonly<SessionState> {
    return { ...this.sessionState };
  }

  public markActivity() {
    this.sessionState.lastActivity = Date.now();
  }

  public forceReset(reason: string = 'manual') {
    return this.resetSession(reason);
  }

  public cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Create and export singleton instance
export const sessionManager = typeof window !== 'undefined' ? new FirebaseSessionManager() : null;

// Export for cleanup on app unmount
export const cleanupSessionManager = () => {
  if (sessionManager) {
    sessionManager.cleanup();
  }
};