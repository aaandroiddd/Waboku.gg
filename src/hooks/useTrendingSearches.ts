import { useState, useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';

interface TrendingSearch {
  term: string;
  count: number;
}

const REFRESH_INTERVAL = 30 * 1000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithRetry = async (retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<TrendingSearch[]> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Trending searches request timeout reached, aborting');
        controller.abort();
      }, 10000); // Increased to 10 second timeout

      console.log('Fetching trending searches...');
      const response = await fetch('/api/trending-searches', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      console.log('Trending searches response received:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Trending searches data parsed successfully');
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }

      setError(null);
      return data;
    } catch (error: any) {
      console.error(`Trending searches attempt failed. Retries left: ${retries}`, error);
      
      if (error.name === 'AbortError') {
        console.error('Trending searches request was aborted due to timeout');
        if (retries > 0) {
          console.log(`Retrying trending searches fetch (${retries} attempts left)...`);
          // Exponential backoff
          const nextDelay = delay * 2;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(retries - 1, nextDelay);
        }
        throw new Error('Trending searches request timed out after multiple attempts');
      }
      
      if (retries > 0) {
        console.log(`Retrying trending searches fetch (${retries} attempts left)...`);
        // Exponential backoff
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
      // Keep the old data if available
      if (trendingSearches.length === 0) {
        setTrendingSearches([]); // Only set empty array if we don't have any data
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
        throw new Error('Firebase Realtime Database is not initialized');
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