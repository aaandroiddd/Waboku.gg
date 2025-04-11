import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface CacheOptions {
  cacheKey: string;
  expirationMinutes?: number;
}

interface CacheData<T> {
  data: T;
  timestamp: number;
  userId: string;
}

export function useDashboardCache<T>(
  fetchFunction: () => Promise<T>,
  options: CacheOptions
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  
  const { cacheKey, expirationMinutes = 5 } = options;
  
  // Create a user-specific cache key
  const userCacheKey = user ? `${cacheKey}_${user.uid}` : null;

  // Function to check if cache is valid
  const isCacheValid = useCallback((cachedData: CacheData<T> | null): boolean => {
    if (!cachedData) return false;
    
    // Check if the cache belongs to the current user
    if (user && cachedData.userId !== user.uid) return false;
    
    // Check if the cache has expired
    const now = Date.now();
    const expirationTime = cachedData.timestamp + (expirationMinutes * 60 * 1000);
    return now < expirationTime;
  }, [user, expirationMinutes]);

  // Function to get data from cache
  const getFromCache = useCallback((): CacheData<T> | null => {
    if (!userCacheKey) return null;
    
    try {
      const cachedItem = localStorage.getItem(userCacheKey);
      if (!cachedItem) return null;
      
      return JSON.parse(cachedItem) as CacheData<T>;
    } catch (err) {
      console.error('Error reading from cache:', err);
      return null;
    }
  }, [userCacheKey]);

  // Function to save data to cache
  const saveToCache = useCallback((data: T): void => {
    if (!userCacheKey || !user) return;
    
    try {
      const cacheData: CacheData<T> = {
        data,
        timestamp: Date.now(),
        userId: user.uid
      };
      
      localStorage.setItem(userCacheKey, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Error saving to cache:', err);
    }
  }, [userCacheKey, user]);

  // Function to fetch fresh data
  const fetchData = useCallback(async (): Promise<void> => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const freshData = await fetchFunction();
      setData(freshData);
      saveToCache(freshData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchFunction, saveToCache]);

  // Function to refresh data (exposed to component)
  const refreshData = useCallback(async (): Promise<void> => {
    await fetchData();
  }, [fetchData]);

  // Initial data loading
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    const loadData = async () => {
      // Try to get data from cache first
      const cachedData = getFromCache();
      
      if (isCacheValid(cachedData)) {
        // Use cached data
        setData(cachedData!.data);
        setIsLoading(false);
      } else {
        // Fetch fresh data
        await fetchData();
      }
    };
    
    loadData();
  }, [user, getFromCache, isCacheValid, fetchData]);

  return { data, isLoading, error, refreshData };
}