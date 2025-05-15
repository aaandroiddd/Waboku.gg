import { useState, useEffect, useRef } from 'react';
import { database, connectionManager } from '@/lib/firebase';
import { ref, get, set, onDisconnect } from 'firebase/database';

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
  const isMounted = useRef(true);

  // Cleanup function to abort any pending requests
  const cleanupPendingRequests = () => {
    if (activeController.current) {
      try {
        // Only abort if the controller is still active
        if (!activeController.current.signal.aborted) {
          activeController.current.abort('cleanup');
        }
      } catch (e) {
        console.warn('[TrendingSearches] Error aborting previous request:', e);
      }
      activeController.current = null;
    }
  };

  const fetchWithRetry = async (retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<TrendingSearch[]> => {
    // Clean up any existing requests
    cleanupPendingRequests();
    
    // If component is unmounted, don't proceed
    if (!isMounted.current) {
      return FALLBACK_TRENDING;
    }
    
    // Skip API calls in preview environments
    if (typeof window !== 'undefined' && window.location.hostname.includes('preview.co.dev')) {
      console.log('[TrendingSearches] Preview environment detected, skipping API call');
      return FALLBACK_TRENDING;
    }
    
    // Return empty array as fallback data
    const emptyTrending: TrendingSearch[] = [];
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Create a new controller for this request
      const controller = new AbortController();
      activeController.current = controller;
      
      // Set up timeout
      timeoutId = setTimeout(() => {
        if (controller.signal.aborted) return;
        console.warn('[TrendingSearches] Request timeout reached, aborting');
        controller.abort('timeout');
      }, REQUEST_TIMEOUT);

      // Use absolute URL with origin to avoid path resolution issues
      // Add a cache-busting parameter to prevent browser caching
      const timestamp = Date.now();
      
      // Use a more robust approach to construct the URL
      let apiUrl;
      try {
        if (typeof window !== 'undefined') {
          // In browser context
          const baseUrl = window.location.origin;
          apiUrl = `${baseUrl}/api/trending-searches?_=${timestamp}`;
        } else {
          // In server context (should not happen in this hook)
          apiUrl = `/api/trending-searches?_=${timestamp}`;
        }
      } catch (error) {
        console.error('[TrendingSearches] Error constructing API URL:', error);
        // Fallback to a simple URL
        apiUrl = `/api/trending-searches?_=${timestamp}`;
      }
      
      console.log(`[TrendingSearches] Fetching from ${apiUrl}`);
      
      // Use a more robust fetch with retry mechanism for network errors
      const fetchWithTimeout = async (url: string, options: RequestInit, attempts = 3): Promise<Response> => {
        try {
          return await fetch(url, options);
        } catch (error: any) {
          if (attempts <= 1 || controller.signal.aborted) throw error;
          
          console.warn(`[TrendingSearches] Fetch attempt failed (${attempts-1} retries left):`, error.message);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchWithTimeout(url, options, attempts - 1);
        }
      };
      
      const response = await fetchWithTimeout(apiUrl, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        // Use 'no-store' to prevent caching
        cache: 'no-store',
        // Include credentials for same-origin requests
        credentials: 'same-origin',
        // Add a longer timeout for slow connections
        timeout: REQUEST_TIMEOUT
      }, 3);

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.warn('[TrendingSearches] Invalid response format - expected an array, got:', typeof data);
        return FALLBACK_TRENDING;
      }

      if (isMounted.current) {
        setError(null);
        setLastSuccessfulFetch(Date.now());
      }
      return data;
    } catch (error: any) {
      console.error('[TrendingSearches] Fetch error:', {
        name: error.name,
        message: error.message,
        type: error.constructor.name
      });
      
      // Clear timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Handle abort errors (timeout or manual abort)
      if (error.name === 'AbortError') {
        console.warn('[TrendingSearches] Request was aborted:', error.message || 'No reason provided');
        
        if (retries > 0 && isMounted.current) {
          console.log(`[TrendingSearches] Retrying after ${delay}ms (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(retries - 1, delay * 1.5);
        }
        
        console.log('[TrendingSearches] All retries failed, using fallback data');
        return FALLBACK_TRENDING;
      }
      
      // Handle other errors with retry logic
      if (retries > 0 && isMounted.current) {
        console.log(`[TrendingSearches] Retrying after ${delay}ms (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1, delay * 1.5);
      }
      
      console.log('[TrendingSearches] All retries failed, using fallback data');
      return FALLBACK_TRENDING;
    } finally {
      // Clear the active controller reference if it's the current one
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
    isMounted.current = true;
    let intervalId: NodeJS.Timeout;

    const initFetch = async () => {
      if (!isMounted.current) return;
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
      isMounted.current = false;
      clearTimeout(initialFetchTimer);
      clearInterval(intervalId);
      cleanupPendingRequests();
    };
  }, []);

  const recordSearch = async (term: string) => {
    if (!term.trim()) return;
    
    try {
      // First try the API endpoint for more reliable recording
      try {
        // Use absolute URL with origin to avoid path resolution issues
        let apiUrl;
        if (typeof window !== 'undefined') {
          const baseUrl = window.location.origin;
          apiUrl = `${baseUrl}/api/search/record`;
        } else {
          apiUrl = `/api/search/record`;
        }
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ searchTerm: term.trim() }),
        });
        
        if (response.ok) {
          console.log(`[TrendingSearches] Successfully recorded search term via API: ${term}`);
          return;
        }
      } catch (apiError) {
        console.warn('[TrendingSearches] Failed to record search via API, falling back to direct DB:', apiError);
      }
      
      // Fallback to direct database write if API fails
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
      
      console.log(`[TrendingSearches] Successfully recorded search term via direct DB: ${term}`);
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