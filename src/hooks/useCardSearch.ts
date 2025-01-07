import { useState, useCallback } from 'react';
import debounce from 'lodash/debounce';

interface CardSearchResult {
  id: string;
  name: string;
  imageUrl: string;
  game: string;
  set?: {
    name?: string;
  };
  number?: string;
  identifier?: string;
}

export function useCardSearch() {
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPokemonCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}*"`, {
      headers: {
        'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY || '',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Pokemon cards');
    }

    const data = await response.json();
    return data.data.map((card: any) => ({
      id: card.id,
      name: `${card.name} (${card.number}/${card.set.printedTotal}) - ${card.id}`,
      imageUrl: card.images.small,
      game: 'Pokemon TCG',
      set: {
        name: card.set.name,
      },
      number: card.number,
      identifier: card.id
    }));
  };

  const searchOnePieceCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`/api/one-piece/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch One Piece cards');
    }

    const data = await response.json();
    return data.data.map((card: any) => ({
      id: card.id,
      name: `${card.name} - ${card.id}`,
      imageUrl: card.images.small,
      game: 'One Piece TCG',
      set: {
        name: card.set?.name,
      },
      number: card.number,
      identifier: card.id
    }));
  };

  const searchDragonBallCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`/api/dragon-ball-fusion/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch Dragon Ball Fusion cards');
    }

    const data = await response.json();
    return (data.data || []).map((card: any) => ({
      id: card.id,
      name: `${card.name} - ${card.id}`,
      imageUrl: card.images?.small || card.images?.large,
      game: 'Dragon Ball Fusion',
      set: {
        name: card.set?.name || 'Unknown Set',
      },
      number: card.number,
      identifier: card.id
    }));
  };

  const searchMTGCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`/api/mtg/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch MTG cards');
    }

    const data = await response.json();
    return data.data.map((card: any) => ({
      id: card.id,
      name: `${card.name} (${card.number}) - ${card.set.name}`,
      imageUrl: card.images.small,
      game: 'Magic: The Gathering',
      set: {
        name: card.set.name,
      },
      number: card.number,
      identifier: card.id
    }));
  };
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPokemonCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}*"`, {
      headers: {
        'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY || '',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Pokemon cards');
    }

    const data = await response.json();
    return data.data.map((card: any) => ({
      id: card.id,
      name: `${card.name} (${card.number}/${card.set.printedTotal}) - ${card.id}`,
      imageUrl: card.images.small,
      game: 'Pokemon TCG',
      set: {
        name: card.set.name,
      },
      number: card.number,
      identifier: card.id
    }));
  };

  const searchOnePieceCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`/api/one-piece/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch One Piece cards');
    }

    const data = await response.json();
    return data.data.map((card: any) => ({
      id: card.id,
      name: `${card.name} - ${card.id}`,
      imageUrl: card.images.small,
      game: 'One Piece TCG',
      set: {
        name: card.set?.name,
      },
      number: card.number,
      identifier: card.id
    }));
  };

  const searchDragonBallCards = async (query: string): Promise<CardSearchResult[]> => {
    const response = await fetch(`/api/dragon-ball-fusion/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch Dragon Ball Fusion cards');
    }

    const data = await response.json();
    return (data.data || []).map((card: any) => ({
      id: card.id,
      name: `${card.name} - ${card.id}`,
      imageUrl: card.images?.small || card.images?.large,
      game: 'Dragon Ball Fusion',
      set: {
        name: card.set?.name || 'Unknown Set',
      },
      number: card.number,
      identifier: card.id
    }));
  };

  const searchCards = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [pokemonCards, onePieceCards, dragonBallCards, mtgCards] = await Promise.all([
          searchPokemonCards(query).catch(error => {
            console.error('Error fetching Pokemon cards:', error);
            return [];
          }),
          searchOnePieceCards(query).catch(error => {
            console.error('Error fetching One Piece cards:', error);
            return [];
          }),
          searchDragonBallCards(query).catch(error => {
            console.error('Error fetching Dragon Ball Fusion cards:', error);
            return [];
          }),
          searchMTGCards(query).catch(error => {
            console.error('Error fetching MTG cards:', error);
            return [];
          }),
        ]);

        const allResults = [...pokemonCards, ...onePieceCards, ...dragonBallCards, ...mtgCards];
        setResults(allResults);
      } catch (error) {
        console.error('Error searching cards:', error);
        setError('Failed to search cards');
      } finally {
        setIsLoading(false);
      }
    }, 300),
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [pokemonCards, onePieceCards, dragonBallCards] = await Promise.all([
          searchPokemonCards(query).catch(error => {
            console.error('Error fetching Pokemon cards:', error);
            return [];
          }),
          searchOnePieceCards(query).catch(error => {
            console.error('Error fetching One Piece cards:', error);
            return [];
          }),
          searchDragonBallCards(query).catch(error => {
            console.error('Error fetching Dragon Ball Fusion cards:', error);
            return [];
          }),
        ]);

        const allResults = [...pokemonCards, ...onePieceCards, ...dragonBallCards];
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

  return {
    results,
    isLoading,
    error,
    searchCards,
  };
}