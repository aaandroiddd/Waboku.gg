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
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/api/trending-searches', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }

      setError(null);
      return data;
    } catch (error: any) {
      console.error(`Attempt failed. Retries left: ${retries}`, error);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      
      if (retries > 0) {
        // Exponential backoff
        const nextDelay = delay * 2;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1, nextDelay);
      }
      
      throw error;
    }
  };

  useEffect(() => {
    let isSubscribed = true;
    let intervalId: NodeJS.Timeout;

    const fetchTrendingSearches = async () => {
      if (!isSubscribed) return;
      
      try {
        const data = await fetchWithRetry();
        if (isSubscribed) {
          setTrendingSearches(data);
          setError(null);
        }
      } catch (error: any) {
        console.error('Error fetching trending searches:', error);
        if (isSubscribed) {
          setError(error.message);
          // Keep the old data if available
          if (trendingSearches.length === 0) {
            setTrendingSearches([]); // Only set empty array if we don't have any data
          }
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchTrendingSearches();

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

  return {
    trendingSearches,
    isLoading: loading,
    error,
    recordSearch,
  };
}