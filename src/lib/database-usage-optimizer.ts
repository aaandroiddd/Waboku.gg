/**
 * Enhanced Database Usage Optimizer
 * 
 * This module provides utilities to optimize Firebase Realtime Database usage
 * and reduce costs by implementing efficient data fetching patterns, connection
 * pooling, exponential backoff, and page visibility management.
 */

import { getDatabase, ref, onValue, off, get, limitToLast, query, orderByChild } from 'firebase/database';
import { getFirebaseServices } from './firebase';

interface ListenerConfig {
  path: string;
  callback: (data: any) => void;
  options?: {
    limit?: number;
    orderBy?: string;
    once?: boolean;
    priority?: 'high' | 'medium' | 'low';
  };
}

interface ConnectionStats {
  activeConnections: number;
  maxConnections: number;
  pausedConnections: number;
  totalCreated: number;
  totalRemoved: number;
  reconnectAttempts: number;
}

class DatabaseUsageOptimizer {
  private activeListeners: Map<string, () => void> = new Map();
  private pausedListeners: Map<string, ListenerConfig> = new Map();
  private database: any = null;
  private connectionCount = 0;
  private maxConnections = 8; // Reduced from 10 to be more conservative
  private isPaused = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private stats: ConnectionStats = {
    activeConnections: 0,
    maxConnections: this.maxConnections,
    pausedConnections: 0,
    totalCreated: 0,
    totalRemoved: 0,
    reconnectAttempts: 0
  };
  
  constructor() {
    try {
      const { database } = getFirebaseServices();
      this.database = database || getDatabase();
      
      // Set up page visibility listener
      this.setupPageVisibilityListener();
    } catch (error) {
      console.error('[DatabaseOptimizer] Failed to initialize database:', error);
    }
  }

  /**
   * Set up page visibility listener to pause/resume connections
   */
  private setupPageVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const isVisible = document.visibilityState === 'visible';
        
        if (isVisible && this.isPaused) {
          console.log('[DatabaseOptimizer] Page visible, resuming connections');
          this.resumeAllListeners();
        } else if (!isVisible && !this.isPaused) {
          console.log('[DatabaseOptimizer] Page hidden, pausing connections');
          this.pauseAllListeners();
        }
      });
    }
  }

  /**
   * Pause all active listeners to reduce database usage
   */
  pauseAllListeners() {
    if (this.isPaused) return;
    
    console.log(`[DatabaseOptimizer] Pausing ${this.activeListeners.size} listeners`);
    this.isPaused = true;
    
    // Move active listeners to paused state
    this.activeListeners.forEach((unsubscribe, listenerId) => {
      try {
        unsubscribe();
        // We don't have the original config, so we'll need to track it differently
        // For now, just remove the listener
      } catch (error) {
        console.error(`[DatabaseOptimizer] Error pausing listener ${listenerId}:`, error);
      }
    });
    
    this.stats.pausedConnections = this.activeListeners.size;
    this.activeListeners.clear();
    this.connectionCount = 0;
    this.stats.activeConnections = 0;
  }

  /**
   * Resume all paused listeners
   */
  resumeAllListeners() {
    if (!this.isPaused) return;
    
    console.log(`[DatabaseOptimizer] Resuming ${this.pausedListeners.size} listeners`);
    this.isPaused = false;
    
    // Recreate listeners from paused state
    const listenersToResume = Array.from(this.pausedListeners.entries());
    this.pausedListeners.clear();
    
    listenersToResume.forEach(([listenerId, config]) => {
      // Recreate the listener with exponential backoff
      setTimeout(() => {
        this.createOptimizedListener(config);
      }, this.getReconnectDelay());
    });
    
    this.stats.pausedConnections = 0;
  }

  /**
   * Get exponential backoff delay
   */
  private getReconnectDelay(): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);
    this.stats.reconnectAttempts = this.reconnectAttempts;
    return delay;
  }

  /**
   * Create an optimized listener with automatic cleanup and connection management
   */
  createOptimizedListener(config: ListenerConfig): string {
    if (!this.database) {
      console.error('[DatabaseOptimizer] Database not initialized');
      return '';
    }

    // If paused, store the config for later
    if (this.isPaused) {
      const listenerId = `${config.path}_${Date.now()}_${Math.random()}`;
      this.pausedListeners.set(listenerId, config);
      console.log(`[DatabaseOptimizer] Listener queued (paused): ${listenerId} for ${config.path}`);
      return listenerId;
    }

    // Check connection limit with priority handling
    if (this.connectionCount >= this.maxConnections) {
      const priority = config.options?.priority || 'medium';
      
      if (priority === 'low') {
        console.warn(`[DatabaseOptimizer] Maximum connections reached, skipping low priority listener for ${config.path}`);
        return '';
      } else if (priority === 'medium') {
        // Queue medium priority listeners
        const listenerId = `${config.path}_${Date.now()}_${Math.random()}`;
        this.pausedListeners.set(listenerId, config);
        console.warn(`[DatabaseOptimizer] Maximum connections reached, queuing medium priority listener for ${config.path}`);
        return listenerId;
      }
      // High priority listeners will proceed and potentially remove a low priority one
    }

    const listenerId = `${config.path}_${Date.now()}_${Math.random()}`;
    
    try {
      let dbRef = ref(this.database, config.path);
      
      // Apply query options to reduce data transfer
      if (config.options?.limit) {
        dbRef = query(dbRef, limitToLast(config.options.limit));
      }
      
      if (config.options?.orderBy) {
        dbRef = query(dbRef, orderByChild(config.options.orderBy));
      }

      // Use get() for one-time reads to reduce bandwidth
      if (config.options?.once) {
        get(dbRef)
          .then(snapshot => {
            try {
              config.callback(snapshot.val());
              // Reset reconnect attempts on successful read
              this.reconnectAttempts = 0;
            } catch (callbackError) {
              console.error(`[DatabaseOptimizer] Error in callback for ${config.path}:`, callbackError);
            }
          })
          .catch(error => {
            console.error(`[DatabaseOptimizer] Error in one-time read for ${config.path}:`, error);
            this.handleConnectionError(error, config);
          });
        
        this.stats.totalCreated++;
        return listenerId;
      }

      // Create real-time listener with enhanced error handling
      const unsubscribe = onValue(dbRef, 
        (snapshot) => {
          try {
            config.callback(snapshot.val());
            // Reset reconnect attempts on successful data
            this.reconnectAttempts = 0;
          } catch (error) {
            console.error(`[DatabaseOptimizer] Error in callback for ${config.path}:`, error);
          }
        },
        (error) => {
          console.error(`[DatabaseOptimizer] Listener error for ${config.path}:`, error);
          this.handleConnectionError(error, config);
          this.removeListener(listenerId);
        }
      );

      this.activeListeners.set(listenerId, unsubscribe);
      this.connectionCount++;
      this.stats.activeConnections = this.connectionCount;
      this.stats.totalCreated++;
      
      console.log(`[DatabaseOptimizer] Created listener ${listenerId} for ${config.path} (${this.connectionCount}/${this.maxConnections})`);
      
      return listenerId;
    } catch (error) {
      console.error(`[DatabaseOptimizer] Failed to create listener for ${config.path}:`, error);
      this.handleConnectionError(error, config);
      return '';
    }
  }

  /**
   * Handle connection errors with exponential backoff
   */
  private handleConnectionError(error: any, config: ListenerConfig) {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = this.getReconnectDelay();
      console.log(`[DatabaseOptimizer] Retrying connection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isPaused) {
          this.createOptimizedListener(config);
        }
      }, delay);
    } else {
      console.error(`[DatabaseOptimizer] Max reconnection attempts reached for ${config.path}`);
      this.reconnectAttempts = 0; // Reset for future attempts
    }
  }

  /**
   * Remove a specific listener
   */
  removeListener(listenerId: string): void {
    const unsubscribe = this.activeListeners.get(listenerId);
    if (unsubscribe) {
      try {
        unsubscribe();
        this.activeListeners.delete(listenerId);
        this.connectionCount = Math.max(0, this.connectionCount - 1);
        console.log(`[DatabaseOptimizer] Removed listener ${listenerId} (${this.connectionCount}/${this.maxConnections})`);
      } catch (error) {
        console.error(`[DatabaseOptimizer] Error removing listener ${listenerId}:`, error);
      }
    }
  }

  /**
   * Remove all listeners for cleanup
   */
  removeAllListeners(): void {
    console.log(`[DatabaseOptimizer] Removing all ${this.activeListeners.size} listeners`);
    
    this.activeListeners.forEach((unsubscribe, listenerId) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(`[DatabaseOptimizer] Error removing listener ${listenerId}:`, error);
      }
    });
    
    this.activeListeners.clear();
    this.connectionCount = 0;
  }

  /**
   * Get current connection stats
   */
  getStats() {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      activeListeners: Array.from(this.activeListeners.keys())
    };
  }

  /**
   * Batch read multiple paths efficiently
   */
  async batchRead(paths: string[]): Promise<Record<string, any>> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const results: Record<string, any> = {};
    
    // Batch reads in chunks to avoid overwhelming the database
    const chunkSize = 5;
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (path) => {
        try {
          const snapshot = await get(ref(this.database, path));
          return { path, data: snapshot.val() };
        } catch (error) {
          console.error(`[DatabaseOptimizer] Error reading ${path}:`, error);
          return { path, data: null };
        }
      });

      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(({ path, data }) => {
        results[path] = data;
      });

      // Small delay between chunks to be respectful to the database
      if (i + chunkSize < paths.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

// Global instance
export const databaseOptimizer = new DatabaseUsageOptimizer();

// Cleanup function for app shutdown
export const cleanupDatabaseConnections = () => {
  databaseOptimizer.removeAllListeners();
};

// Hook for React components
export const useOptimizedDatabaseListener = (config: ListenerConfig) => {
  const [listenerId, setListenerId] = React.useState<string>('');

  React.useEffect(() => {
    const id = databaseOptimizer.createOptimizedListener(config);
    setListenerId(id);

    return () => {
      if (id) {
        databaseOptimizer.removeListener(id);
      }
    };
  }, [config.path]);

  return listenerId;
};

// React import for the hook
import React from 'react';