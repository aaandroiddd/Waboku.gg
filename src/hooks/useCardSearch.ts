import { useState, useCallback } from 'react';
import _ from 'lodash';

interface CardResult {
  id: string | number;
  name: string;
  set: {
    name: string;
  };
  number?: string;
  identifier: string;
  images: {
    small?: string;
    large?: string;
  };
}

const recordSearchTerm = async (term: string) => {
  try {
    const response = await fetch('/api/search/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ searchTerm: term }),
    });

    if (!response.ok) {
      console.error('Failed to record search term:', await response.text());
    }
  } catch (error) {
    console.error('Error recording search term:', error);
  }
};

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
        // Record the search term
        await recordSearchTerm(query.trim());
        
        // For now, we'll return an empty array as we've removed the external APIs
        // This should be replaced with your actual search implementation
        setResults([]);
        
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

export { useCardSearch };