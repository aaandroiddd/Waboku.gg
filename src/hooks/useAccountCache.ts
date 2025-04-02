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
  const { getFromCache, saveToCache } = useClientCache<{
    tier: AccountTier;
    timestamp: number;
  }>({
    key: cacheKey,
    expirationMinutes: 5
  });
  
  // Get cached account tier
  const getCachedAccountTier = (): AccountTier | null => {
    if (!userId) return null;
    
    const { data, expired } = getFromCache();
    if (data && !expired) {
      return data.tier;
    }
    
    return null;
  };
  
  // Save account tier to cache
  const cacheAccountTier = (tier: AccountTier): void => {
    if (!userId) return;
    
    saveToCache({
      tier,
      timestamp: Date.now()
    });
  };
  
  return {
    getCachedAccountTier,
    cacheAccountTier
  };
}