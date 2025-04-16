import { ref, query, limitToLast, orderByChild, get, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from './firebase';

/**
 * Optimized version of onValue that includes query constraints and proper cleanup
 * @param path Database path
 * @param callback Callback function to handle data
 * @param limit Maximum number of items to retrieve
 * @param orderBy Field to order by
 * @returns Unsubscribe function
 */
export const optimizedOnValue = (
  path: string,
  callback: (data: any) => void,
  limit?: number,
  orderBy?: string
) => {
  // Create a reference with query constraints if provided
  let dbRef = ref(database, path);
  
  if (orderBy && limit) {
    dbRef = query(ref(database, path), orderByChild(orderBy), limitToLast(limit));
  } else if (limit) {
    dbRef = query(ref(database, path), limitToLast(limit));
  }
  
  // Set up the listener
  const unsubscribe = onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });
  
  // Return unsubscribe function for cleanup
  return () => {
    unsubscribe();
  };
};

/**
 * Optimized version of get that includes query constraints
 * @param path Database path
 * @param limit Maximum number of items to retrieve
 * @param orderBy Field to order by
 * @returns Promise with data snapshot
 */
export const optimizedGet = async (
  path: string,
  limit?: number,
  orderBy?: string
) => {
  // Create a reference with query constraints if provided
  let dbRef = ref(database, path);
  
  if (orderBy && limit) {
    dbRef = query(ref(database, path), orderByChild(orderBy), limitToLast(limit));
  } else if (limit) {
    dbRef = query(ref(database, path), limitToLast(limit));
  }
  
  // Get data once
  const snapshot = await get(dbRef);
  return snapshot;
};

/**
 * Paginated data fetcher for large collections
 * @param path Database path
 * @param pageSize Number of items per page
 * @param orderBy Field to order by
 * @param startAfter Value to start after for pagination
 * @returns Promise with paginated data and pagination info
 */
export const getPaginatedData = async (
  path: string,
  pageSize: number = 20,
  orderBy?: string,
  startAfter?: any
) => {
  try {
    let dbRef;
    
    if (orderBy && startAfter) {
      // This is a simplified implementation - in a real app,
      // you would need to use startAfter with the Firebase Admin SDK
      // or implement client-side filtering
      dbRef = query(ref(database, path), orderByChild(orderBy), limitToLast(pageSize));
    } else if (orderBy) {
      dbRef = query(ref(database, path), orderByChild(orderBy), limitToLast(pageSize));
    } else {
      dbRef = query(ref(database, path), limitToLast(pageSize));
    }
    
    const snapshot = await get(dbRef);
    
    if (!snapshot.exists()) {
      return {
        items: [],
        hasMore: false,
        lastItem: null
      };
    }
    
    // Convert to array and reverse for correct order
    const data = snapshot.val();
    const items = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));
    
    // Sort if orderBy is specified
    if (orderBy) {
      items.sort((a, b) => {
        if (a[orderBy] < b[orderBy]) return -1;
        if (a[orderBy] > b[orderBy]) return 1;
        return 0;
      });
    }
    
    return {
      items,
      hasMore: items.length === pageSize,
      lastItem: items.length > 0 ? items[items.length - 1] : null
    };
  } catch (error) {
    console.error('Error fetching paginated data:', error);
    return {
      items: [],
      hasMore: false,
      lastItem: null
    };
  }
};

/**
 * Cache manager for database queries
 */
export class DatabaseCache {
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private maxAge: number; // Cache expiration in milliseconds
  
  constructor(maxAgeInSeconds: number = 300) { // Default 5 minutes
    this.maxAge = maxAgeInSeconds * 1000;
  }
  
  /**
   * Get data from cache or fetch from database
   * @param path Database path
   * @param fetchFn Function to fetch data if not in cache
   * @returns Promise with data
   */
  async getOrFetch(path: string, fetchFn: () => Promise<any>): Promise<any> {
    const cacheKey = path;
    const cachedItem = this.cache.get(cacheKey);
    
    // Return cached data if valid
    if (cachedItem && Date.now() - cachedItem.timestamp < this.maxAge) {
      return cachedItem.data;
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the result
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
  
  /**
   * Invalidate a specific cache entry
   * @param path Database path
   */
  invalidate(path: string): void {
    this.cache.delete(path);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// Create a singleton instance of the cache
export const databaseCache = new DatabaseCache();

/**
 * Optimized hook-friendly database query function with caching
 * @param path Database path
 * @param options Query options
 * @returns Promise with data
 */
export const optimizedQuery = async (
  path: string,
  options: {
    limit?: number;
    orderBy?: string;
    useCache?: boolean;
    cacheMaxAge?: number; // in seconds
  } = {}
) => {
  const { limit, orderBy, useCache = true, cacheMaxAge } = options;
  
  // Use custom cache if specified
  const cache = new DatabaseCache(cacheMaxAge);
  
  if (useCache) {
    return cache.getOrFetch(path, async () => {
      const snapshot = await optimizedGet(path, limit, orderBy);
      return snapshot.exists() ? snapshot.val() : null;
    });
  } else {
    const snapshot = await optimizedGet(path, limit, orderBy);
    return snapshot.exists() ? snapshot.val() : null;
  }
};