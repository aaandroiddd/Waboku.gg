import { useState, useEffect } from 'react';

interface CacheOptions {
  key: string;
  expirationMinutes?: number;
}

export function useClientCache<T>(options: CacheOptions) {
  const { key, expirationMinutes = 15 } = options;
  
  // Function to get data from cache
  const getFromCache = (): { data: T | null, expired: boolean } => {
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
  };
  
  // Function to save data to cache
  const saveToCache = (data: T): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(key, JSON.stringify(cacheItem));
      console.log(`Data cached for key: ${key}`);
    } catch (error) {
      console.error(`Error caching data for key ${key}:`, error);
    }
  };
  
  // Function to clear specific cache
  const clearCache = (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(key);
    console.log(`Cache cleared for key: ${key}`);
  };
  
  return {
    getFromCache,
    saveToCache,
    clearCache
  };
}