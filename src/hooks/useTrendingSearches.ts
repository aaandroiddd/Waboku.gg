import { useState, useEffect, useRef } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';

interface TrendingSearch {
  term: string;
  count: number;
}

// No fallback data - we'll show a message instead
const FALLBACK_TRENDING: TrendingSearch[] = [];

const REFRESH_INTERVAL = 180 * 1000; // 180 seconds (increased from 120)
const MAX_RETRIES = 1; // Reduced from 2 to avoid excessive retries
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const REQUEST_TIMEOUT = 5000; // 5 seconds (increased from 3)

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>(FALLBACK_TRENDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<number | null>(null);
  const activeController = useRef<AbortController | null>(null);

  // Cleanup function to abort any pending requests
  const cleanupPendingRequests = () => {
    if (activeController.current) {
      try {
        activeController.current.abort();
      } catch (e) {
        console.warn('[TrendingSearches] Error aborting previous request:', e);
      }
      activeController.current = null;
    }
  };

  const fetchWithRetry = async (retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<TrendingSearch[]> => {
    // Clean up any existing requests
    cleanupPendingRequests();
    
    try {
      // Create a new controller for this request
      const controller = new AbortController();
      activeController.current = controller;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (controller.signal.aborted) return;
        console.warn('[TrendingSearches] Request timeout reached, aborting');
        controller.abort('timeout');
      }, REQUEST_TIMEOUT);

      // Use absolute URL with origin to avoid path resolution issues
      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/trending-searches` 
        : '/api/trending-searches';
      
      console.log(`[TrendingSearches] Fetching from ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        cache: 'no-store',
        // Add a unique parameter to prevent caching
        credentials: 'same-origin'
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.warn('[TrendingSearches] Invalid response format - expected an array, got:', typeof data);
        return FALLBACK_TRENDING;
      }

      setError(null);
      setLastSuccessfulFetch(Date.now());
      return data;
    } catch (error: any) {
      console.error('[TrendingSearches] Fetch error:', {
        name: error.name,
        message: error.message,
        type: error.constructor.name
      });
      
      // Handle abort errors (timeout or manual abort)
      if (error.name === 'AbortError') {
        console.warn('[TrendingSearches] Request was aborted');
        
        if (retries > 0) {
          console.log(`[TrendingSearches] Retrying after ${delay}ms (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(retries - 1, delay * 1.5);
        }
        
        console.log('[TrendingSearches] All retries failed, using fallback data');
        return FALLBACK_TRENDING;
      }
      
      // Handle other errors with retry logic
      if (retries > 0) {
        console.log(`[TrendingSearches] Retrying after ${delay}ms (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1, delay * 1.5);
      }
      
      console.log('[TrendingSearches] All retries failed, using fallback data');
      return FALLBACK_TRENDING;
    } finally {
      // Clear the active controller reference
      if (activeController.current?.signal.aborted) {
        activeController.current = null;
      }
    }
  };

  const fetchTrendingSearches = async () => {
    // Don't set loading state if we already have data
    const isInitialFetch = !lastSuccessfulFetch;
    if (isInitialFetch) {
      setLoading(true);
    }
    
    try {
      const data = await fetchWithRetry();
      setTrendingSearches(data);
      setError(null);
    } catch (error: any) {
      console.error('[TrendingSearches] Error fetching trending searches:', error);
      setError(error.message || 'Unknown error fetching trending searches');
      
      // Only use fallback data if we don't have any data yet
      if (trendingSearches.length === 0) {
        setTrendingSearches(FALLBACK_TRENDING);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    let intervalId: NodeJS.Timeout;

    const initFetch = async () => {
      if (!isSubscribed) return;
      await fetchTrendingSearches();
    };

    // Initial fetch with a small delay to allow other critical components to load first
    const initialFetchTimer = setTimeout(() => {
      initFetch();
    }, 800); // Increased from 500ms to allow more time for other components

    // Set up periodic refresh
    intervalId = setInterval(fetchTrendingSearches, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearTimeout(initialFetchTimer);
      clearInterval(intervalId);
      cleanupPendingRequests();
    };
  }, []);

  const recordSearch = async (term: string) => {
    if (!term.trim()) return;
    
    try {
      if (!database) {
        console.warn('[TrendingSearches] Cannot record search: database not initialized');
        return; // Silently fail if database is not initialized
      }

      const searchTermRef = ref(database, `searchTerms/${term.trim().toLowerCase()}`);
      const snapshot = await get(searchTermRef);
      const currentCount = snapshot.exists() ? snapshot.val().count || 0 : 0;
      
      await set(searchTermRef, {
        term: term.trim(),
        count: currentCount + 1,
        lastUpdated: Date.now()
      });
      
      console.log(`[TrendingSearches] Successfully recorded search term: ${term}`);
    } catch (error) {
      console.error('[TrendingSearches] Error recording search:', error);
      // Don't throw the error as this is a non-critical operation
    }
  };

  const refreshTrending = async () => {
    console.log('[TrendingSearches] Manual refresh requested');
    // Clean up any existing requests before starting a new one
    cleanupPendingRequests();
    await fetchTrendingSearches();
  };

  return {
    trendingSearches,
    loading,
    error,
    recordSearch,
    refreshTrending,
  };
}