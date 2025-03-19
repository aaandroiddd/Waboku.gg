import { useRef, useCallback } from 'react';

interface CacheOptions {
  key: string;
  expirationMinutes?: number;
}

export function useClientCache<T>(options: CacheOptions) {
  // Use refs to ensure the functions don't change on re-renders
  const optionsRef = useRef(options);
  const { key, expirationMinutes = 15 } = optionsRef.current;
  
  // Function to get data from cache
  const getFromCache = useCallback((): { data: T | null, expired: boolean } => {
    if (typeof window === 'undefined') return { data: null, expired: true };
    
    try {
      const cachedItem = sessionStorage.getItem(key);
      
      if (!cachedItem) return { data: null, expired: true };
      
      const { data, timestamp } = JSON.parse(cachedItem);
      const now = Date.now();
      const expirationTime = expirationMinutes * 60 * 1000;
      const isExpired = now - timestamp > expirationTime;
      
      return { 
        data: isExpired ? null : data, 
        expired: isExpired 
      };
    } catch (error) {
      console.error(`Error retrieving cached data for key ${key}:`, error);
      // Clear invalid cache
      sessionStorage.removeItem(key);
      return { data: null, expired: true };
    }
  }, [key, expirationMinutes]);
  
  // Function to save data to cache
  const saveToCache = useCallback((data: T): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(key, JSON.stringify(cacheItem));
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Data cached for key: ${key}`);
      }
    } catch (error) {
      console.error(`Error caching data for key ${key}:`, error);
    }
  }, [key]);
  
  // Function to clear specific cache
  const clearCache = useCallback((): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(key);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Cache cleared for key: ${key}`);
    }
  }, [key]);
  
  return {
    getFromCache,
    saveToCache,
    clearCache
  };
}