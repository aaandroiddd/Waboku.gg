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

interface SearchResponse {
  data: CardResult[];
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
        // Make parallel requests to all card game APIs
        const [mtgResponse, pokemonResponse, onePieceResponse] = await Promise.allSettled([
          fetch(`/api/mtg/search?query=${encodeURIComponent(query)}`),
          fetch(`/api/pokemon/search?query=${encodeURIComponent(query)}`),
          fetch(`/api/one-piece/search?query=${encodeURIComponent(query)}`),
        ]);

        const allResults: CardResult[] = [];

        // Process MTG results
        if (mtgResponse.status === 'fulfilled' && mtgResponse.value.ok) {
          const data: SearchResponse = await mtgResponse.value.json();
          allResults.push(...data.data);
        }

        // Process Pokemon results
        if (pokemonResponse.status === 'fulfilled' && pokemonResponse.value.ok) {
          const data: SearchResponse = await pokemonResponse.value.json();
          allResults.push(...data.data);
        }

        // Process One Piece results
        if (onePieceResponse.status === 'fulfilled' && onePieceResponse.value.ok) {
          const data: SearchResponse = await onePieceResponse.value.json();
          allResults.push(...data.data);
        }

        setResults(allResults);
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