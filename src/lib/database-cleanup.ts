/**
 * Database Cleanup Utilities
 * 
 * This module provides utilities to clean up Firebase Realtime Database
 * connections and prevent memory leaks and excessive usage.
 */

import { databaseOptimizer, cleanupDatabaseConnections } from './database-usage-optimizer';

class DatabaseCleanupManager {
  private cleanupCallbacks: (() => void)[] = [];
  private isCleaningUp = false;
  
  /**
   * Register a cleanup callback
   */
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }
  
  /**
   * Perform cleanup of all registered callbacks
   */
  cleanup(): void {
    if (this.isCleaningUp) return;
    
    this.isCleaningUp = true;
    console.log('[DatabaseCleanup] Starting cleanup of all database connections');
    
    // Execute all registered cleanup callbacks
    this.cleanupCallbacks.forEach((callback, index) => {
      try {
        callback();
      } catch (error) {
        console.error(`[DatabaseCleanup] Error in cleanup callback ${index}:`, error);
      }
    });
    
    // Clean up the database optimizer
    cleanupDatabaseConnections();
    
    // Clear the callbacks array
    this.cleanupCallbacks = [];
    
    console.log('[DatabaseCleanup] Cleanup completed');
    this.isCleaningUp = false;
  }
  
  /**
   * Get current stats
   */
  getStats() {
    return {
      registeredCallbacks: this.cleanupCallbacks.length,
      optimizerStats: databaseOptimizer.getStats(),
      isCleaningUp: this.isCleaningUp
    };
  }
}

// Global cleanup manager instance
export const databaseCleanupManager = new DatabaseCleanupManager();

// Setup cleanup on page unload
if (typeof window !== 'undefined') {
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    databaseCleanupManager.cleanup();
  });
  
  // Clean up on page visibility change (when user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Reduce connections when page is hidden
      console.log('[DatabaseCleanup] Page hidden, reducing database connections');
      // Don't do full cleanup, but could reduce some non-essential listeners
    }
  });
  
  // Clean up on focus loss (additional safety)
  window.addEventListener('blur', () => {
    // Optional: reduce some listeners when window loses focus
  });
}

/**
 * Hook for React components to register cleanup
 */
export const useCleanupRegistration = (cleanupFn: () => void) => {
  React.useEffect(() => {
    databaseCleanupManager.registerCleanup(cleanupFn);
    
    // Return the cleanup function to be called on unmount
    return cleanupFn;
  }, []);
};

// React import
import React from 'react';