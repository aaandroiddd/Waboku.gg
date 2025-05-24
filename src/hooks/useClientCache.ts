import { useRef, useCallback } from 'react';

interface CacheOptions {
  key: string;
  expirationMinutes?: number;
}

export function useClientCache<T>(options: CacheOptions) {
  // Store options in a ref to ensure stability across renders
  const optionsRef = useRef(options);
  
  // Extract values from the ref, not directly from options
  const key = optionsRef.current.key;
  const expirationMinutes = optionsRef.current.expirationMinutes || 15;
  
  // Function to get data from cache
  const getFromCache = useCallback((): { data: T | null, expired: boolean } => {
    if (typeof window === 'undefined') return { data: null, expired: true };
    
    try {
      // Try localStorage first, then fall back to sessionStorage
      // This helps with cross-domain issues since localStorage is more persistent
      const cachedItem = localStorage.getItem(key) || sessionStorage.getItem(key);
      
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
      
      // Store in both localStorage and sessionStorage for better persistence
      localStorage.setItem(key, JSON.stringify(cacheItem));
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
    // Clear from both storage types
    localStorage.removeItem(key);
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