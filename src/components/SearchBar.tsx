import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Loader2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import debounce from 'lodash/debounce';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  set: {
    name: string;
    series: string;
  };
  images: {
    small: string;
  };
  type: 'pokemon';
}

interface MtgCard {
  id: string;
  name: string;
  collector_number: string;
  set_name: string;
  image_uris?: {
    small: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small: string;
    };
  }>;
  type: 'mtg';
}

type Card = PokemonCard | MtgCard;

type GameType = 'pokemon' | 'mtg';

export default function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameType>('pokemon');

  const searchPokemonCards = async (query: string) => {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}*"&orderBy=name&pageSize=20`, {
      headers: {
        'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY || ''
      }
    });
    
    if (!response.ok) {
      throw new Error('Pokemon API request failed');
    }
    
    const data = await response.json();
    return (data.data || []).map((card: any) => ({
      ...card,
      type: 'pokemon' as const
    }));
  };

  const searchMtgCards = async (query: string) => {
    const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name&unique=prints`);
    
    if (!response.ok) {
      throw new Error('MTG API request failed');
    }
    
    const data = await response.json();
    return (data.data || []).map((card: any) => ({
      ...card,
      type: 'mtg' as const
    }));
  };

  const searchCards = async (query: string) => {
    if (!query) {
      setCards([]);
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const cards = selectedGame === 'pokemon' 
        ? await searchPokemonCards(query)
        : await searchMtgCards(query);
      
      setCards(cards.slice(0, 20));
      setOpen(true);
    } catch (error) {
      console.error('Error fetching cards:', error);
      setCards([]);
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce the search to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setShowSuggestions(true);
      searchCards(query);
    }, 500),
    [selectedGame]
  );

  useEffect(() => {
    setShowSuggestions(false);
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setCards([]);
      setOpen(false);
    }

    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const handleSearch = (card?: Card) => {
    if (card) {
      const searchTerm = card.type === 'pokemon'
        ? `${card.name} ${card.number}`
        : `${card.name} ${card.collector_number}`;
      
      router.push({
        pathname: '/listings',
        query: { 
          query: searchTerm.trim(),
          game: card.type
        }
      });
    } else if (searchQuery.trim()) {
      router.push({
        pathname: '/listings',
        query: { 
          query: searchQuery.trim(),
          game: selectedGame
        }
      });
    }
    setOpen(false);
    setShowSuggestions(false);
  };

  const getCardImage = (card: Card) => {
    if (card.type === 'pokemon') {
      return card.images?.small;
    } else {
      return card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small;
    }
  };

  const getCardDetails = (card: Card) => {
    if (card.type === 'pokemon') {
      return {
        name: card.name,
        set: card.set.name,
        series: card.set.series,
        number: card.number
      };
    } else {
      return {
        name: card.name,
        set: card.set_name,
        series: '',
        number: card.collector_number
      };
    }
  };

  return (
    <div className="w-full space-y-2">
      <ToggleGroup 
        type="single" 
        value={selectedGame}
        onValueChange={(value: GameType) => {
          if (value) {
            setSelectedGame(value);
            setSearchQuery('');
            setCards([]);
          }
        }}
        className="justify-start"
      >
        <ToggleGroupItem value="pokemon" aria-label="Pokemon TCG">
          Pokémon
        </ToggleGroupItem>
        <ToggleGroupItem value="mtg" aria-label="Magic: The Gathering">
          Magic
        </ToggleGroupItem>
      </ToggleGroup>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Input
              type="text"
              placeholder={`Search for ${selectedGame === 'pokemon' ? 'Pokémon' : 'Magic'} cards...`}
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="pl-10 h-12 w-full"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </div>
          </div>
        </PopoverTrigger>
        {searchQuery && showSuggestions && (
          <PopoverContent 
            className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[400px] overflow-auto" 
            align="start"
            sideOffset={5}
          >
            <Command>
              <CommandList>
                {isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Loading suggestions...</span>
                  </div>
                ) : cards.length === 0 ? (
                  <CommandEmpty>No results found.</CommandEmpty>
                ) : (
                  <CommandGroup heading="Suggestions">
                    {cards.map((card) => {
                      const details = getCardDetails(card);
                      const imageUrl = getCardImage(card);
                      
                      return (
                        <CommandItem
                          key={card.id}
                          onSelect={() => handleSearch(card)}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent"
                        >
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={details.name}
                              className="w-10 h-14 object-contain"
                            />
                          )}
                          <div className="flex flex-col">
                            <div className="font-medium">{details.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Set: {details.set} {details.series && `(${details.series})`}
                            </div>
                            <div className="text-xs font-semibold text-primary">
                              Card #: {details.number}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}