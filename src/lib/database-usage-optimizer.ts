/**
 * Database Usage Optimizer
 * 
 * This module provides utilities to optimize Firebase Realtime Database usage
 * and reduce costs by implementing efficient data fetching patterns.
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
  };
}

class DatabaseUsageOptimizer {
  private activeListeners: Map<string, () => void> = new Map();
  private database: any = null;
  private connectionCount = 0;
  private maxConnections = 10; // Limit concurrent connections
  
  constructor() {
    try {
      const { database } = getFirebaseServices();
      this.database = database || getDatabase();
    } catch (error) {
      console.error('[DatabaseOptimizer] Failed to initialize database:', error);
    }
  }

  /**
   * Create an optimized listener with automatic cleanup
   */
  createOptimizedListener(config: ListenerConfig): string {
    if (!this.database) {
      console.error('[DatabaseOptimizer] Database not initialized');
      return '';
    }

    // Check connection limit
    if (this.connectionCount >= this.maxConnections) {
      console.warn('[DatabaseOptimizer] Maximum connections reached, queuing listener');
      // Could implement a queue here if needed
      return '';
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
            config.callback(snapshot.val());
          })
          .catch(error => {
            console.error(`[DatabaseOptimizer] Error in one-time read for ${config.path}:`, error);
          });
        
        return listenerId;
      }

      // Create real-time listener
      const unsubscribe = onValue(dbRef, 
        (snapshot) => {
          try {
            config.callback(snapshot.val());
          } catch (error) {
            console.error(`[DatabaseOptimizer] Error in callback for ${config.path}:`, error);
          }
        },
        (error) => {
          console.error(`[DatabaseOptimizer] Listener error for ${config.path}:`, error);
          this.removeListener(listenerId);
        }
      );

      this.activeListeners.set(listenerId, unsubscribe);
      this.connectionCount++;
      
      console.log(`[DatabaseOptimizer] Created listener ${listenerId} for ${config.path} (${this.connectionCount}/${this.maxConnections})`);
      
      return listenerId;
    } catch (error) {
      console.error(`[DatabaseOptimizer] Failed to create listener for ${config.path}:`, error);
      return '';
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