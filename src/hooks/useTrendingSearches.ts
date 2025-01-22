import { useState, useEffect } from 'react';
import { getDatabase, ref, push } from 'firebase/database';
import { app } from '@/lib/firebase';

interface TrendingSearch {
  term: string;
  count: number;
}

export function useTrendingSearches() {
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchTrendingSearches();
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