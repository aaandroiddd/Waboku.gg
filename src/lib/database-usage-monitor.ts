import { ref, onValue, query, limitToLast, orderByChild, get } from 'firebase/database';
import { database } from './firebase';
import { logEvent } from 'firebase/analytics';
import { getAnalytics } from 'firebase/analytics';

// Track database operations with timestamps and paths
interface DatabaseOperation {
  path: string;
  operation: 'read' | 'write' | 'listen';
  timestamp: number;
  source: string; // Component or function that initiated the operation
  size?: number; // Approximate size of data if available
}

// In-memory store for recent operations (to avoid writing to database too frequently)
const recentOperations: DatabaseOperation[] = [];
const OPERATIONS_LIMIT = 1000; // Limit the number of operations stored in memory

// Flag to enable/disable detailed logging
let detailedLoggingEnabled = process.env.NODE_ENV === 'development';

/**
 * Enable or disable detailed database operation logging
 */
export const setDetailedLogging = (enabled: boolean) => {
  detailedLoggingEnabled = enabled;
  console.log(`Detailed database logging ${enabled ? 'enabled' : 'disabled'}`);
};

/**
 * Log a database operation
 */
export const logDatabaseOperation = (
  path: string,
  operation: 'read' | 'write' | 'listen',
  source: string,
  size?: number
) => {
  if (!detailedLoggingEnabled) return;
  
  const dbOp: DatabaseOperation = {
    path,
    operation,
    timestamp: Date.now(),
    source,
    size
  };
  
  // Add to recent operations
  recentOperations.push(dbOp);
  
  // Keep only the most recent operations
  if (recentOperations.length > OPERATIONS_LIMIT) {
    recentOperations.shift();
  }
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB ${operation.toUpperCase()}] ${path} from ${source}${size ? ` (${size} bytes)` : ''}`);
  }
  
  // In production, log high-volume operations to analytics
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    try {
      const analytics = getAnalytics();
      logEvent(analytics, 'database_operation', {
        path,
        operation,
        source
      });
    } catch (error) {
      // Analytics might not be available
    }
  }
};

/**
 * Get recent database operations
 */
export const getRecentOperations = () => {
  return [...recentOperations];
};

/**
 * Clear recent operations
 */
export const clearRecentOperations = () => {
  recentOperations.length = 0;
};

/**
 * Wrapper for database.ref().get() that logs the operation
 */
export const monitoredGet = async (path: string, source: string) => {
  logDatabaseOperation(path, 'read', source);
  const snapshot = await get(ref(database, path));
  
  // Estimate size of data
  let size = 0;
  if (snapshot.exists()) {
    size = JSON.stringify(snapshot.val()).length;
    logDatabaseOperation(path, 'read', source, size);
  }
  
  return snapshot;
};

/**
 * Wrapper for database.ref().onValue() that logs the operation
 */
export const monitoredOnValue = (path: string, callback: any, source: string) => {
  logDatabaseOperation(path, 'listen', source);
  
  return onValue(ref(database, path), (snapshot) => {
    // Estimate size of data
    if (snapshot.exists()) {
      const size = JSON.stringify(snapshot.val()).length;
      logDatabaseOperation(path, 'read', source, size);
    }
    
    callback(snapshot);
  });
};

/**
 * Get paths with the highest number of operations
 */
export const getHighUsagePaths = () => {
  const pathCounts: Record<string, { reads: number, writes: number, listens: number, totalSize: number }> = {};
  
  recentOperations.forEach(op => {
    if (!pathCounts[op.path]) {
      pathCounts[op.path] = { reads: 0, writes: 0, listens: 0, totalSize: 0 };
    }
    
    if (op.operation === 'read') {
      pathCounts[op.path].reads++;
    } else if (op.operation === 'write') {
      pathCounts[op.path].writes++;
    } else if (op.operation === 'listen') {
      pathCounts[op.path].listens++;
    }
    
    if (op.size) {
      pathCounts[op.path].totalSize += op.size;
    }
  });
  
  return Object.entries(pathCounts)
    .map(([path, stats]) => ({
      path,
      ...stats,
      totalOperations: stats.reads + stats.writes + stats.listens
    }))
    .sort((a, b) => b.totalOperations - a.totalOperations);
};

/**
 * Get sources with the highest number of operations
 */
export const getHighUsageSources = () => {
  const sourceCounts: Record<string, { reads: number, writes: number, listens: number, totalSize: number }> = {};
  
  recentOperations.forEach(op => {
    if (!sourceCounts[op.source]) {
      sourceCounts[op.source] = { reads: 0, writes: 0, listens: 0, totalSize: 0 };
    }
    
    if (op.operation === 'read') {
      sourceCounts[op.source].reads++;
    } else if (op.operation === 'write') {
      sourceCounts[op.source].writes++;
    } else if (op.operation === 'listen') {
      sourceCounts[op.source].listens++;
    }
    
    if (op.size) {
      sourceCounts[op.source].totalSize += op.size;
    }
  });
  
  return Object.entries(sourceCounts)
    .map(([source, stats]) => ({
      source,
      ...stats,
      totalOperations: stats.reads + stats.writes + stats.listens
    }))
    .sort((a, b) => b.totalOperations - a.totalOperations);
};