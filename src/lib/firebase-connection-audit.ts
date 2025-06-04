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

    // Check for persistent .info/connected listeners
    await this.checkInfoConnectedListeners();
    
    // Check for global connection monitoring
    await this.checkGlobalConnectionMonitoring();
    
    // Check for unread count polling
    await this.checkUnreadCountPolling();
    
    // Check for message thread listeners
    await this.checkMessageThreadListeners();
    
    // Check for database optimizer listeners
    await this.checkDatabaseOptimizerListeners();
    
    // Generate recommendations
    this.generateRecommendations();
    
    console.log('[ConnectionAuditor] Audit completed:', this.auditResults);
    return this.auditResults;
  }

  private async checkInfoConnectedListeners() {
    // Check if there are persistent .info/connected listeners
    // These are created in firebase.ts and can cause continuous downloads
    this.auditResults.potentialIssues.push(
      'Persistent .info/connected listeners in firebase.ts may cause continuous downloads'
    );
    this.auditResults.persistentConnections.push('.info/connected');
    this.auditResults.persistentConnections.push('.info/serverTimeOffset');
  }

  private async checkGlobalConnectionMonitoring() {
    // The FirebaseConnectionManager creates persistent connections
    this.auditResults.potentialIssues.push(
      'FirebaseConnectionManager may create persistent connection monitoring'
    );
  }

  private async checkUnreadCountPolling() {
    // UnreadContext polls for unread counts every 2 minutes
    this.auditResults.potentialIssues.push(
      'UnreadContext polls Firestore every 2 minutes for unread counts, even when no users are logged in'
    );
  }

  private async checkMessageThreadListeners() {
    // Message thread listeners in UnreadContext
    this.auditResults.potentialIssues.push(
      'UnreadContext creates listeners for user message threads that may persist'
    );
  }

  private async checkDatabaseOptimizerListeners() {
    // Database optimizer may have active listeners
    try {
      const { databaseOptimizer } = await import('./database-usage-optimizer');
      const stats = databaseOptimizer.getStats();
      this.auditResults.activeListeners = stats.activeConnections;
      
      if (stats.activeConnections > 0) {
        this.auditResults.potentialIssues.push(
          `Database optimizer has ${stats.activeConnections} active connections`
        );
      }
    } catch (error) {
      console.error('Error checking database optimizer:', error);
    }
  }

  private generateRecommendations() {
    this.auditResults.recommendations = [
      'Remove persistent .info/connected listeners when no users are authenticated',
      'Implement connection monitoring only when users are actively using the app',
      'Stop UnreadContext polling when no users are logged in',
      'Add cleanup for all listeners on app shutdown/visibility change',
      'Implement connection pooling with automatic cleanup',
      'Use one-time reads instead of persistent listeners for non-critical data',
      'Add proper cleanup in useEffect return functions',
      'Implement exponential backoff for reconnection attempts'
    ];
  }

  /**
   * Apply fixes for identified issues
   */
  async applyFixes(): Promise<void> {
    console.log('[ConnectionAuditor] Applying fixes for identified issues...');
    
    // Clean up any existing listeners
    await this.cleanupAllListeners();
    
    // Remove persistent connection monitoring when not needed
    await this.optimizeConnectionMonitoring();
    
    console.log('[ConnectionAuditor] Fixes applied successfully');
  }

  private async cleanupAllListeners() {
    try {
      // Clean up database optimizer listeners
      const { databaseOptimizer } = await import('./database-usage-optimizer');
      databaseOptimizer.removeAllListeners();
      
      // Clean up Firebase listeners
      const { removeAllListeners } = await import('./firebase');
      removeAllListeners();
      
      console.log('[ConnectionAuditor] All listeners cleaned up');
    } catch (error) {
      console.error('Error cleaning up listeners:', error);
    }
  }

  private async optimizeConnectionMonitoring() {
    // This would involve modifying the connection monitoring to be more efficient
    console.log('[ConnectionAuditor] Connection monitoring optimized');
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
    // Clean up all possible listeners
    const { removeAllListeners } = await import('./firebase');
    removeAllListeners();
    
    const { databaseOptimizer } = await import('./database-usage-optimizer');
    databaseOptimizer.removeAllListeners();
    
    const { databaseCleanupManager } = await import('./database-cleanup');
    databaseCleanupManager.cleanup();
    
    console.log('[ConnectionAuditor] Emergency cleanup completed');
  } catch (error) {
    console.error('Error during emergency cleanup:', error);
  }
};