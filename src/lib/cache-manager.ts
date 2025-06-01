/**
 * Cache Manager - Centralized cache management for the application
 * This utility helps manage various caches to prevent stale data issues
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  userId?: string;
}

export class CacheManager {
  private static instance: CacheManager;
  
  private constructor() {}
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  /**
   * Clear all user-specific caches when subscription status changes
   */
  clearUserCaches(userId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheKeys = [
        `waboku_account_tier_${userId}`,
        `waboku_premium_status_${userId}`,
        `profile_${userId}`,
        `dashboard_data_${userId}`,
        `listings_${userId}`,
        `subscription_data_${userId}`
      ];
      
      // Clear from both localStorage and sessionStorage
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Clear any other user-specific caches
      this.clearCachesByPattern(userId);
      
      console.log('Cleared all user caches for:', userId);
    } catch (error) {
      console.error('Error clearing user caches:', error);
    }
  }
  
  /**
   * Clear caches by pattern matching
   */
  private clearCachesByPattern(pattern: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Clear localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes(pattern) || key.includes('waboku_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear sessionStorage
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes(pattern) || key.includes('waboku_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing caches by pattern:', error);
    }
  }
  
  /**
   * Force refresh all premium-related caches
   */
  refreshPremiumCaches(userId: string, newTier: 'free' | 'premium'): void {
    if (typeof window === 'undefined') return;
    
    try {
      const timestamp = Date.now();
      
      // Update account tier cache
      const accountTierCache = {
        tier: newTier,
        timestamp,
        userId
      };
      
      localStorage.setItem(`waboku_account_tier_${userId}`, JSON.stringify(accountTierCache));
      sessionStorage.setItem(`waboku_account_tier_${userId}`, JSON.stringify(accountTierCache));
      
      // Update premium status cache
      const premiumStatusCache = {
        tier: newTier,
        timestamp,
        userId
      };
      
      localStorage.setItem(`waboku_premium_status_${userId}`, JSON.stringify(premiumStatusCache));
      sessionStorage.setItem(`waboku_premium_status_${userId}`, JSON.stringify(premiumStatusCache));
      
      console.log('Refreshed premium caches with new tier:', newTier);
    } catch (error) {
      console.error('Error refreshing premium caches:', error);
    }
  }
  
  /**
   * Check if any cache is stale and needs refresh
   */
  checkCacheHealth(userId: string): {
    isHealthy: boolean;
    staleKeys: string[];
    recommendations: string[];
  } {
    if (typeof window === 'undefined') {
      return { isHealthy: true, staleKeys: [], recommendations: [] };
    }
    
    const staleKeys: string[] = [];
    const recommendations: string[] = [];
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    try {
      const keysToCheck = [
        `waboku_account_tier_${userId}`,
        `waboku_premium_status_${userId}`
      ];
      
      keysToCheck.forEach(key => {
        const cached = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            if (now - data.timestamp > maxAge) {
              staleKeys.push(key);
            }
          } catch (parseError) {
            staleKeys.push(key);
            recommendations.push(`Invalid cache data for ${key}, should be cleared`);
          }
        }
      });
      
      // Check for inconsistencies between localStorage and sessionStorage
      keysToCheck.forEach(key => {
        const localData = localStorage.getItem(key);
        const sessionData = sessionStorage.getItem(key);
        
        if (localData && sessionData) {
          try {
            const local = JSON.parse(localData);
            const session = JSON.parse(sessionData);
            
            if (local.tier !== session.tier) {
              recommendations.push(`Inconsistent data between localStorage and sessionStorage for ${key}`);
            }
          } catch (error) {
            recommendations.push(`Parse error for ${key} in storage comparison`);
          }
        }
      });
      
      const isHealthy = staleKeys.length === 0 && recommendations.length === 0;
      
      return {
        isHealthy,
        staleKeys,
        recommendations
      };
    } catch (error) {
      console.error('Error checking cache health:', error);
      return {
        isHealthy: false,
        staleKeys: [],
        recommendations: ['Error checking cache health']
      };
    }
  }
  
  /**
   * Get cache statistics for debugging
   */
  getCacheStats(userId: string): {
    totalKeys: number;
    userSpecificKeys: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    if (typeof window === 'undefined') {
      return {
        totalKeys: 0,
        userSpecificKeys: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
    
    try {
      let totalKeys = 0;
      let userSpecificKeys = 0;
      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;
      
      // Check localStorage
      Object.keys(localStorage).forEach(key => {
        totalKeys++;
        const value = localStorage.getItem(key) || '';
        totalSize += key.length + value.length;
        
        if (key.includes(userId) || key.includes('waboku_')) {
          userSpecificKeys++;
          
          try {
            const data = JSON.parse(value);
            if (data.timestamp) {
              if (!oldestEntry || data.timestamp < oldestEntry) {
                oldestEntry = data.timestamp;
              }
              if (!newestEntry || data.timestamp > newestEntry) {
                newestEntry = data.timestamp;
              }
            }
          } catch (error) {
            // Ignore parse errors for non-JSON data
          }
        }
      });
      
      return {
        totalKeys,
        userSpecificKeys,
        totalSize,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalKeys: 0,
        userSpecificKeys: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }
  
  /**
   * Emergency cache clear - use when all else fails
   */
  emergencyCacheClear(): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Clear all waboku-related caches
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('waboku_') || key.includes('account') || key.includes('premium')) {
          localStorage.removeItem(key);
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('waboku_') || key.includes('account') || key.includes('premium')) {
          sessionStorage.removeItem(key);
        }
      });
      
      console.log('Emergency cache clear completed');
    } catch (error) {
      console.error('Error during emergency cache clear:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Utility functions for easy access
export const clearUserCaches = (userId: string) => cacheManager.clearUserCaches(userId);
export const refreshPremiumCaches = (userId: string, tier: 'free' | 'premium') => 
  cacheManager.refreshPremiumCaches(userId, tier);
export const checkCacheHealth = (userId: string) => cacheManager.checkCacheHealth(userId);
export const getCacheStats = (userId: string) => cacheManager.getCacheStats(userId);
export const emergencyCacheClear = () => cacheManager.emergencyCacheClear();