import { useState, useCallback } from 'react';
import _ from 'lodash';

interface CardResult {
  id: string | number;
  name: string;
  setName: string;
  imageUrl?: string;
}

const useCardSearch = () => {
  const [results, setResults] = useState<CardResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchCards = useCallback(
    _.debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Simulated API calls - replace with your actual API endpoints
        const mockResults = [
          { id: 1, name: 'Blue-Eyes White Dragon', setName: 'Legend of Blue Eyes' },
          { id: 2, name: 'Dark Magician', setName: 'Metal Raiders' },
        ];
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setResults(mockResults);
      } catch (error) {
        console.error('Error searching cards:', error);
        setError('Failed to search cards');
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  return { results, isLoading, error, searchCards };
};

export default useCardSearch;