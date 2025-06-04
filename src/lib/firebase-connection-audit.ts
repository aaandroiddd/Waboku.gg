/**
 * Firebase Connection Audit
 * 
 * This module helps identify and fix sources of excessive Realtime Database usage
 * that can cause high costs even when no users are actively using the application.
 */

import { getDatabase, ref, onValue, off, get } from 'firebase/database';
import { getFirebaseServices } from './firebase';

interface ConnectionAudit {
  activeListeners: number;
  persistentConnections: string[];
  recommendations: string[];
  potentialIssues: string[];
}

class FirebaseConnectionAuditor {
  private auditResults: ConnectionAudit = {
    activeListeners: 0,
    persistentConnections: [],
    recommendations: [],
    potentialIssues: []
  };

  /**
   * Perform a comprehensive audit of Firebase connections
   */
  async performAudit(): Promise<ConnectionAudit> {
    console.log('[ConnectionAuditor] Starting Firebase connection audit...');
    
    this.auditResults = {
      activeListeners: 0,
      persistentConnections: [],
      recommendations: [],
      potentialIssues: []
    };

    // Check for active listeners in Firebase
    await this.checkActiveFirebaseListeners();
    
    // Check for database optimizer listeners
    await this.checkDatabaseOptimizerListeners();
    
    // Check for UnreadContext issues
    await this.checkUnreadContextIssues();
    
    // Check for connection manager issues
    await this.checkConnectionManagerIssues();
    
    // Generate recommendations based on findings
    this.generateRecommendations();
    
    console.log('[ConnectionAuditor] Audit completed:', this.auditResults);
    return this.auditResults;
  }

  private async checkActiveFirebaseListeners() {
    try {
      const { getActiveListenersCount } = await import('./firebase');
      const activeCount = getActiveListenersCount();
      this.auditResults.activeListeners += activeCount;
      
      if (activeCount > 0) {
        this.auditResults.potentialIssues.push(
          `Firebase has ${activeCount} active Firestore listeners that may cause continuous downloads`
        );
        this.auditResults.persistentConnections.push(`Firestore listeners (${activeCount})`);
      }
    } catch (error) {
      console.error('Error checking Firebase listeners:', error);
      this.auditResults.potentialIssues.push(
        'Unable to check Firebase listener status - potential memory leaks'
      );
    }
  }

  private async checkDatabaseOptimizerListeners() {
    try {
      const { databaseOptimizer } = await import('./database-usage-optimizer');
      const stats = databaseOptimizer.getStats();
      this.auditResults.activeListeners += stats.activeConnections;
      
      if (stats.activeConnections > 0) {
        this.auditResults.potentialIssues.push(
          `Database optimizer has ${stats.activeConnections} active RTDB connections`
        );
        this.auditResults.persistentConnections.push(`RTDB optimizer (${stats.activeConnections})`);
      }
    } catch (error) {
      console.error('Error checking database optimizer:', error);
    }
  }

  private async checkUnreadContextIssues() {
    // Check if UnreadContext is running when no users are authenticated
    if (typeof window !== 'undefined') {
      // Check if there are any intervals running (UnreadContext polling)
      const intervalCount = (window as any).__unreadContextIntervals?.length || 0;
      if (intervalCount > 0) {
        this.auditResults.potentialIssues.push(
          `UnreadContext has ${intervalCount} active polling intervals that may run even when users are not authenticated`
        );
      }
      
      // Check localStorage for any cached auth state that might keep polling active
      try {
        const authState = localStorage.getItem('firebase:authUser');
        if (!authState) {
          this.auditResults.potentialIssues.push(
            'UnreadContext may be polling for unread counts even when no user is authenticated'
          );
        }
      } catch (error) {
        // localStorage access might fail in some environments
      }
    }
  }

  private async checkConnectionManagerIssues() {
    try {
      const { connectionManager } = await import('./firebase');
      if (connectionManager) {
        // Check if connection manager is running persistent monitoring
        this.auditResults.potentialIssues.push(
          'FirebaseConnectionManager may be running persistent connection monitoring'
        );
        this.auditResults.persistentConnections.push('ConnectionManager monitoring');
      }
    } catch (error) {
      console.error('Error checking connection manager:', error);
    }
  }

  private generateRecommendations() {
    const recommendations = [];
    
    if (this.auditResults.activeListeners > 0) {
      recommendations.push('Clean up active listeners to reduce database usage');
    }
    
    if (this.auditResults.persistentConnections.length > 0) {
      recommendations.push('Remove persistent connections when users are not authenticated');
    }
    
    recommendations.push(
      'Implement authentication-based listener management',
      'Use page visibility API to pause listeners when page is hidden',
      'Implement exponential backoff for reconnection attempts',
      'Use one-time reads instead of persistent listeners for non-critical data',
      'Add proper cleanup in useEffect return functions',
      'Monitor database usage regularly to catch issues early'
    );
    
    this.auditResults.recommendations = recommendations;
  }

  /**
   * Apply fixes for identified issues
   */
  async applyFixes(): Promise<void> {
    console.log('[ConnectionAuditor] Applying fixes for identified issues...');
    
    let fixesApplied = 0;
    
    try {
      // Fix 1: Clean up all active listeners
      const listenersRemoved = await this.cleanupAllListeners();
      if (listenersRemoved > 0) {
        console.log(`[ConnectionAuditor] Removed ${listenersRemoved} active listeners`);
        fixesApplied++;
      }
      
      // Fix 2: Clean up database optimizer
      await this.cleanupDatabaseOptimizer();
      fixesApplied++;
      
      // Fix 3: Clean up any persistent intervals
      await this.cleanupPersistentIntervals();
      fixesApplied++;
      
      // Fix 4: Clear any cached data that might be causing issues
      await this.clearCachedData();
      fixesApplied++;
      
      console.log(`[ConnectionAuditor] Applied ${fixesApplied} fixes successfully`);
    } catch (error) {
      console.error('Error applying fixes:', error);
      throw error;
    }
  }

  private async cleanupAllListeners(): Promise<number> {
    let totalRemoved = 0;
    
    try {
      // Clean up Firebase Firestore listeners
      const { removeAllListeners } = await import('./firebase');
      const firestoreRemoved = removeAllListeners();
      totalRemoved += firestoreRemoved;
      console.log(`[ConnectionAuditor] Removed ${firestoreRemoved} Firestore listeners`);
    } catch (error) {
      console.error('Error cleaning up Firebase listeners:', error);
    }
    
    return totalRemoved;
  }

  private async cleanupDatabaseOptimizer(): Promise<void> {
    try {
      const { databaseOptimizer } = await import('./database-usage-optimizer');
      databaseOptimizer.removeAllListeners();
      console.log('[ConnectionAuditor] Cleaned up database optimizer listeners');
    } catch (error) {
      console.error('Error cleaning up database optimizer:', error);
    }
  }

  private async cleanupPersistentIntervals(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Clear any intervals that might be running
      try {
        // Get the highest interval ID and clear all intervals up to that point
        const highestId = setTimeout(() => {}, 0);
        for (let i = 1; i <= highestId; i++) {
          clearInterval(i);
          clearTimeout(i);
        }
        console.log('[ConnectionAuditor] Cleared all intervals and timeouts');
      } catch (error) {
        console.error('Error clearing intervals:', error);
      }
    }
  }

  private async clearCachedData(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        // Clear Firebase-related localStorage items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('firebase') || 
            key.includes('firestore') || 
            key.includes('rtdb') ||
            key.startsWith('fs_')
          )) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear sessionStorage as well
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (
            key.includes('firebase') || 
            key.includes('firestore') || 
            key.includes('rtdb')
          )) {
            sessionKeysToRemove.push(key);
          }
        }
        
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
        
        console.log(`[ConnectionAuditor] Cleared ${keysToRemove.length} localStorage and ${sessionKeysToRemove.length} sessionStorage items`);
      } catch (error) {
        console.error('Error clearing cached data:', error);
      }
    }
  }
}

// Global auditor instance
export const connectionAuditor = new FirebaseConnectionAuditor();

// Utility function to run audit and get results
export const auditFirebaseConnections = async (): Promise<ConnectionAudit> => {
  return await connectionAuditor.performAudit();
};

// Utility function to apply fixes
export const fixFirebaseConnections = async (): Promise<void> => {
  await connectionAuditor.applyFixes();
};

// Emergency cleanup function
export const emergencyCleanup = async (): Promise<void> => {
  console.log('[ConnectionAuditor] Performing emergency cleanup...');
  
  try {
    // Apply all fixes
    await connectionAuditor.applyFixes();
    
    // Additional emergency measures
    try {
      const { databaseCleanupManager } = await import('./database-cleanup');
      databaseCleanupManager.cleanup();
      console.log('[ConnectionAuditor] Database cleanup manager executed');
    } catch (error) {
      console.error('Error running database cleanup manager:', error);
    }
    
    // Force garbage collection if available
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
      console.log('[ConnectionAuditor] Forced garbage collection');
    }
    
    console.log('[ConnectionAuditor] Emergency cleanup completed');
  } catch (error) {
    console.error('Error during emergency cleanup:', error);
    throw error;
  }
};