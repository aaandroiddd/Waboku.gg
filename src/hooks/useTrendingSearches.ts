import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';

interface TrendingSearch {
  term: string;
  count: number;
}

// Fallback data in case of errors
const FALLBACK_TRENDING = [
  { term: "Charizard", count: 42 },
  { term: "Pikachu", count: 38 },
  { term: "Black Lotus", count: 35 },
  { term: "Mox Pearl", count: 30 },
  { term: "Jace", count: 28 }
];

const REFRESH_INTERVAL = 120 * 1000; // 120 seconds (increased from 60)
const MAX_RETRIES = 1; // Reduced from 2 to avoid excessive retries
const INITIAL_RETRY_DELAY = 2000; // 2 seconds (increased from 1)
const REQUEST_TIMEOUT = 3000; // 3 seconds (reduced from 5)

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>(FALLBACK_TRENDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<number | null>(null);

  const fetchWithRetry = async (retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<TrendingSearch[]> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
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
        cache: 'no-store'
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format - expected an array');
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
      
      if (error.name === 'AbortError') {
        console.warn('[TrendingSearches] Request timed out after', REQUEST_TIMEOUT, 'ms');
        if (retries > 0) {
          console.log(`[TrendingSearches] Retrying after ${delay}ms (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(retries - 1, delay * 1.5);
        }
        throw new Error('Request timed out');
      }
      
      if (retries > 0) {
        console.log(`[TrendingSearches] Retrying after ${delay}ms (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1, delay * 1.5);
      }
      
      throw error;
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
      setError(error.message);
      
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
    }, 500);

    // Set up periodic refresh
    intervalId = setInterval(fetchTrendingSearches, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearTimeout(initialFetchTimer);
      clearInterval(intervalId);
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