import { useCallback } from 'react';

/**
 * Hook to provide cache clearing functionality for listings
 */
export function useCacheClearing() {
  /**
   * Clears all listing-related caches from localStorage and sessionStorage
   */
  const clearAllListingCaches = useCallback(() => {
    try {
      // Clear localStorage caches
      const localStorageCacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('listings_') || 
        key.includes('listing') ||
        key.includes('homePageListings')
      );
      
      for (const key of localStorageCacheKeys) {
        localStorage.removeItem(key);
      }
      
      // Clear sessionStorage caches
      const sessionStorageCacheKeys = Object.keys(sessionStorage).filter(key => 
        key.startsWith('listings_') || 
        key.includes('listing') ||
        key.includes('homePageListings') ||
        key.includes('homePageListingsTimestamp')
      );
      
      for (const key of sessionStorageCacheKeys) {
        sessionStorage.removeItem(key);
      }
      
      console.log('Successfully cleared all listing caches');
      return true;
    } catch (error) {
      console.error('Error clearing listing caches:', error);
      return false;
    }
  }, []);

  /**
   * Clears cache for a specific listing ID
   */
  const clearListingCache = useCallback((listingId: string) => {
    try {
      if (!listingId) return false;
      
      // Clear any localStorage caches that might contain this listing
      const localStorageCacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('listings_') || 
        key.includes('listing') ||
        key.includes('homePageListings')
      );
      
      for (const key of localStorageCacheKeys) {
        localStorage.removeItem(key);
      }
      
      // Clear any sessionStorage caches that might contain this listing
      const sessionStorageCacheKeys = Object.keys(sessionStorage).filter(key => 
        key.startsWith('listings_') || 
        key.includes('listing') ||
        key.includes('homePageListings') ||
        key.includes('homePageListingsTimestamp')
      );
      
      for (const key of sessionStorageCacheKeys) {
        sessionStorage.removeItem(key);
      }
      
      console.log(`Successfully cleared caches for listing: ${listingId}`);
      return true;
    } catch (error) {
      console.error(`Error clearing caches for listing ${listingId}:`, error);
      return false;
    }
  }, []);

  return {
    clearAllListingCaches,
    clearListingCache
  };
}