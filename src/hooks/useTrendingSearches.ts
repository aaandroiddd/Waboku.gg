import { useState, useEffect } from 'react';
import { getDatabase, ref, push, onValue, Query, query, orderByChild, limitToLast } from 'firebase/database';
import { app } from '@/lib/firebase';

interface TrendingSearch {
  term: string;
  count: number;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const REAL_TIME_LIMIT = 100; // Limit real-time updates to last 100 searches
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithRetry = async (retries = MAX_RETRIES): Promise<TrendingSearch[]> => {
    try {
      const response = await fetch('/api/trending-searches');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setError(null);
      return data;
    } catch (error: any) {
      console.error(`Attempt failed. Retries left: ${retries}`, error);
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchWithRetry(retries - 1);
      }
      
      throw new Error(error.message || 'Failed to fetch trending searches');
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isSubscribed = true;

    const setupRealtimeListener = () => {
      try {
        const db = getDatabase(app);
        const searchesRef = ref(db, 'searches');
        const searchesQuery: Query = query(
          searchesRef,
          orderByChild('timestamp'),
          limitToLast(REAL_TIME_LIMIT)
        );

        unsubscribe = onValue(searchesQuery, () => {
          if (isSubscribed) {
            fetchTrendingSearches();
          }
        });
      } catch (error) {
        console.error('Error setting up realtime listener:', error);
      }
    };

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
          setTrendingSearches([]); // Fallback to empty array
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchTrendingSearches();

    // Set up real-time listener
    setupRealtimeListener();

    // Set up periodic refresh
    const intervalId = setInterval(fetchTrendingSearches, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const recordSearch = async (term: string) => {
    try {
      const db = getDatabase(app);
      const searchesRef = ref(db, 'searches');
      await push(searchesRef, {
        term,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error recording search:', error);
    }
  };

  return {
    trendingSearches,
    loading,
    error,
    recordSearch,
  };
}