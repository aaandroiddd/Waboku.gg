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
  const [isTyping, setIsTyping] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);

  const searchCards = async (query: string) => {
    if (!query) {
      setCards([]);
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}*"&orderBy=name&pageSize=10`, {
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
      setIsTyping(false);
    }
  };

  // Debounce the search to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce((query: string) => searchCards(query), 200),
    []
  );

  useEffect(() => {
    if (searchQuery) {
      setIsTyping(true);
      debouncedSearch(searchQuery);
    } else {
      setCards([]);
      setOpen(false);
      setIsTyping(false);
    }

    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const handleSearch = (cardName?: string) => {
    const queryToUse = cardName || searchQuery;
    if (queryToUse.trim()) {
      router.push({
        pathname: '/listings',
        query: { query: queryToUse.trim() }
      });
      setOpen(false);
    }
  };

  return (
    <div className="w-full relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center w-full">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search cards..."
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
                {(isLoading || isTyping) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="sr-only">Search</span>
              </Button>
            </div>
          </div>
        </PopoverTrigger>
        {searchQuery && (
          <PopoverContent 
            className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-auto" 
            align="start"
            sideOffset={5}
          >
            <Command>
              <CommandList>
                {isTyping ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Loading suggestions...</span>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Searching...</span>
                  </div>
                ) : cards.length === 0 ? (
                  <CommandEmpty>No results found.</CommandEmpty>
                ) : (
                  <CommandGroup heading="Suggestions">
                    {cards.map((card) => (
                      <CommandItem
                        key={card.id}
                        onSelect={() => handleSearch(card.name)}
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
                            {card.set.name} ({card.set.series})
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