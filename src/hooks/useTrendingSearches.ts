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

const REFRESH_INTERVAL = 60 * 1000; // 60 seconds (increased from 30)
const MAX_RETRIES = 2; // Reduced from 3 to avoid excessive retries
const INITIAL_RETRY_DELAY = 1000; // 1 second

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>(FALLBACK_TRENDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithRetry = async (retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<TrendingSearch[]> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000); // 5 second timeout (reduced from 10)

      // Use absolute URL with origin to avoid path resolution issues
      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/trending-searches` 
        : '/api/trending-searches';
      
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
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
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (retries > 0) {
          const nextDelay = delay * 2;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(retries - 1, nextDelay);
        }
        throw new Error('Request timed out');
      }
      
      if (retries > 0) {
        const nextDelay = delay * 2;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1, nextDelay);
      }
      
      throw error;
    }
  };

  const fetchTrendingSearches = async () => {
    setLoading(true);
    try {
      const data = await fetchWithRetry();
      setTrendingSearches(data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching trending searches:', error);
      setError(error.message);
      // Use fallback data if we don't have any data
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

    // Initial fetch
    initFetch();

    // Set up periodic refresh
    intervalId = setInterval(fetchTrendingSearches, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, []);

  const recordSearch = async (term: string) => {
    if (!term.trim()) return;
    
    try {
      if (!database) {
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
    } catch (error) {
      console.error('Error recording search:', error);
      // Don't throw the error as this is a non-critical operation
    }
  };

  const refreshTrending = async () => {
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