import { useState, useEffect } from 'react';
import { getDatabase, ref, push, onValue, Query, query, orderByChild, limitToLast } from 'firebase/database';
import { app } from '@/lib/firebase';

interface TrendingSearch {
  term: string;
  count: number;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const REAL_TIME_LIMIT = 100; // Limit real-time updates to last 100 searches

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupRealtimeListener = () => {
      const db = getDatabase(app);
      const searchesRef = ref(db, 'searches');
      const searchesQuery: Query = query(
        searchesRef,
        orderByChild('timestamp'),
        limitToLast(REAL_TIME_LIMIT)
      );

      unsubscribe = onValue(searchesQuery, () => {
        // When we receive updates, trigger a refresh of trending searches
        fetchTrendingSearches();
      });
    };

    const fetchTrendingSearches = async () => {
      try {
        const response = await fetch('/api/trending-searches');
        if (!response.ok) throw new Error('Failed to fetch trending searches');
        const data = await response.json();
        setTrendingSearches(data);
      } catch (error) {
        console.error('Error fetching trending searches:', error);
      } finally {
        setLoading(false);
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
    recordSearch,
  };
}