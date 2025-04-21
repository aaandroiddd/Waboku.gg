import { useState, useEffect, useCallback } from 'react';
import { Listing } from '@/types/database';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface DashboardCacheOptions {
  userId: string | null | undefined;
  expirationMinutes?: number;
  cacheVersion?: string;
}

/**
 * Hook for caching dashboard data with proper cache invalidation
 */
export function useDashboardCache<T>({
  userId,
  expirationMinutes = 30,
  cacheVersion = 'v1',
}: DashboardCacheOptions) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [cachedData, setCachedData] = useState<T | null>(null);
  
  // Generate cache key based on user ID
  const cacheKey = userId ? `dashboard_data_${userId}` : null;
  
  // Check if cache is valid
  const isCacheValid = useCallback((cache: CacheItem<T>) => {
    const now = Date.now();
    const expirationTime = expirationMinutes * 60 * 1000;
    const isExpired = now - cache.timestamp > expirationTime;
    const isVersionMatch = cache.version === cacheVersion;
    
    return !isExpired && isVersionMatch;
  }, [expirationMinutes, cacheVersion]);
  
  // Load data from cache on initialization
  useEffect(() => {
    if (!cacheKey || isInitialized) return;
    
    try {
      const cachedItem = localStorage.getItem(cacheKey);
      
      if (cachedItem) {
        const cache = JSON.parse(cachedItem) as CacheItem<T>;
        
        if (isCacheValid(cache)) {
          setCachedData(cache.data);
          console.log('Dashboard data loaded from cache');
        } else {
          // Clear invalid cache
          localStorage.removeItem(cacheKey);
          console.log('Dashboard cache expired or version mismatch, cleared');
        }
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error loading dashboard cache:', error);
      // Clear potentially corrupted cache
      if (cacheKey) localStorage.removeItem(cacheKey);
      setIsInitialized(true);
    }
  }, [cacheKey, isCacheValid, isInitialized]);
  
  // Save data to cache
  const saveToCache = useCallback((data: T) => {
    if (!cacheKey) return;
    
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        version: cacheVersion,
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      setCachedData(data);
      console.log('Dashboard data saved to cache');
    } catch (error) {
      console.error('Error saving dashboard cache:', error);
    }
  }, [cacheKey, cacheVersion]);
  
  // Clear cache
  const clearCache = useCallback(() => {
    if (!cacheKey) return;
    
    localStorage.removeItem(cacheKey);
    setCachedData(null);
    console.log('Dashboard cache cleared');
  }, [cacheKey]);
  
  // Update cache if data changes
  const updateCache = useCallback((updater: (prevData: T | null) => T) => {
    const newData = updater(cachedData);
    saveToCache(newData);
  }, [cachedData, saveToCache]);
  
  return {
    cachedData,
    saveToCache,
    clearCache,
    updateCache,
    isInitialized,
  };
}

/**
 * Specialized hook for caching dashboard listings
 */
export function useDashboardListingsCache({
  userId,
  expirationMinutes = 30,
}: {
  userId: string | null | undefined;
  expirationMinutes?: number;
}) {
  const {
    cachedData: cachedListings,
    saveToCache: saveListingsToCache,
    clearCache: clearListingsCache,
    updateCache: updateListingsCache,
    isInitialized,
  } = useDashboardCache<Listing[]>({
    userId,
    expirationMinutes,
    cacheVersion: 'listings_v1',
  });
  
  return {
    cachedListings,
    saveListingsToCache,
    clearListingsCache,
    updateListingsCache,
    isInitialized,
  };
}