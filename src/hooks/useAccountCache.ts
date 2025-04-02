import { useEffect, useState } from 'react';
import { useClientCache } from './useClientCache';
import { useAuth } from '@/contexts/AuthContext';
import { AccountTier } from '@/types/account';

// Cache key prefix for account tier
const ACCOUNT_TIER_CACHE_KEY = 'waboku_account_tier';

/**
 * Hook to cache and retrieve user account tier information
 * This helps prevent flickering when loading premium features
 */
export function useAccountCache() {
  const { user } = useAuth();
  const userId = user?.uid;
  
  // Create a user-specific cache key
  const cacheKey = userId ? `${ACCOUNT_TIER_CACHE_KEY}_${userId}` : ACCOUNT_TIER_CACHE_KEY;
  
  // Initialize client cache with a 5-minute expiration
  const { getFromCache, saveToCache, clearCache } = useClientCache<{
    tier: AccountTier;
    timestamp: number;
  }>({
    key: cacheKey,
    expirationMinutes: 5
  });
  
  // Get cached account tier
  const getCachedAccountTier = (): AccountTier | null => {
    if (!userId) return null;
    
    try {
      const { data, expired } = getFromCache();
      if (data && !expired) {
        console.log('Using cached account tier:', data.tier);
        return data.tier;
      }
    } catch (error) {
      console.error('Error retrieving cached account tier:', error);
      // Clear potentially corrupted cache
      clearCache();
    }
    
    return null;
  };
  
  // Save account tier to cache
  const cacheAccountTier = (tier: AccountTier): void => {
    if (!userId) return;
    
    try {
      console.log('Caching account tier:', tier);
      saveToCache({
        tier,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error caching account tier:', error);
    }
  };
  
  // Force refresh the cache with current tier
  const refreshCache = (tier: AccountTier): void => {
    if (!userId) return;
    
    try {
      // Clear existing cache first
      clearCache();
      
      // Then set the new value
      console.log('Force refreshing account tier cache:', tier);
      saveToCache({
        tier,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error refreshing account tier cache:', error);
    }
  };
  
  return {
    getCachedAccountTier,
    cacheAccountTier,
    refreshCache
  };
}