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
import debounce from 'lodash/debounce';

interface Card {
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
}

export default function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchCards = async (query: string) => {
    if (!query) {
      setCards([]);
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}*"&orderBy=name&pageSize=20`, {
        headers: {
          'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('API request failed');
      }
      
      const data = await response.json();
      setCards(data.data || []);
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
    []
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
      const searchTerm = `${card.name} ${card.number}`.trim();
      router.push({
        pathname: '/listings',
        query: { query: searchTerm }
      });
    } else if (searchQuery.trim()) {
      router.push({
        pathname: '/listings',
        query: { query: searchQuery.trim() }
      });
    }
    setOpen(false);
    setShowSuggestions(false);
  };

  const getCardDisplayName = (card: Card) => {
    return `${card.name} - ${card.number}`;
  };

  return (
    <div className="w-full relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center w-full">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search cards... (e.g., 'Pikachu', 'Ash's Pikachu SM108')"
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
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => handleSearch()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="sr-only">Search</span>
              </Button>
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
                    {cards.map((card) => (
                      <CommandItem
                        key={card.id}
                        onSelect={() => handleSearch(card.id)}
                        className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent"
                      >
                        {card.images?.small && (
                          <img
                            src={card.images.small}
                            alt={card.name}
                            className="w-10 h-14 object-contain"
                          />
                        )}
                        <div className="flex flex-col">
                          <div className="font-medium">{card.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Set: {card.set.name} ({card.set.series})
                          </div>
                          <div className="text-xs font-semibold text-primary">
                            Card #: {card.number}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
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