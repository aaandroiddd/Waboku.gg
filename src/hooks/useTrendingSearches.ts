import { useState, useEffect } from 'react';
import { ref, push, onValue, Query, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '@/lib/firebase';

interface TrendingSearch {
  term: string;
  count: number;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const REAL_TIME_LIMIT = 100; // Limit real-time updates to last 100 searches
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithRetry = async (retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<TrendingSearch[]> => {
    try {
      const response = await fetch('/api/trending-searches');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setError(null);
      return data;
    } catch (error: any) {
      console.error(`Attempt failed. Retries left: ${retries}`, error);
      
      if (retries > 0) {
        // Exponential backoff
        const nextDelay = delay * 2;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1, nextDelay);
      }
      
      throw new Error(error.message || 'Failed to fetch trending searches');
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isSubscribed = true;
    let retryTimeout: NodeJS.Timeout;

    const setupRealtimeListener = () => {
      try {
        if (!database) {
          console.warn('Firebase Realtime Database is not initialized, will retry...');
          retryTimeout = setTimeout(setupRealtimeListener, 2000);
          return;
        }

        const searchesRef = ref(database, 'searches');
        const searchesQuery: Query = query(
          searchesRef,
          orderByChild('timestamp'),
          limitToLast(REAL_TIME_LIMIT)
        );

        unsubscribe = onValue(searchesQuery, () => {
          if (isSubscribed) {
            fetchTrendingSearches();
          }
        }, (error) => {
          console.error('Error in realtime listener:', error);
          setError('Failed to setup realtime updates');
        });
      } catch (error) {
        console.error('Error setting up realtime listener:', error);
        setError('Failed to setup realtime updates');
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

    // Set up real-time listener
    setupRealtimeListener();

    // Set up periodic refresh
    const intervalId = setInterval(fetchTrendingSearches, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      clearTimeout(retryTimeout);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const recordSearch = async (term: string) => {
    try {
      if (!database) {
        throw new Error('Firebase Realtime Database is not initialized');
      }

      const searchesRef = ref(database, 'searches');
      await push(searchesRef, {
        term,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error recording search:', error);
      // Don't throw the error as this is a non-critical operation
    }
  };

  return {
    trendingSearches,
    loading,
    error,
    recordSearch,
  };
}