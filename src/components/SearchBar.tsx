import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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
  const [cards, setCards] = useState<Card[]>([]);

  const searchCards = async (query: string) => {
    if (!query) {
      setCards([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}*"&orderBy=name&pageSize=10`, {
        headers: {
          'X-Api-Key': process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY || ''
        }
      });
      const data = await response.json();
      setCards(data.data || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce the search to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce((query: string) => searchCards(query), 300),
    []
  );

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setCards([]);
    }
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
    <div className="w-full max-w-md">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center w-full">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
        <PopoverContent className="p-0 w-full" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                {cards.map((card) => (
                  <CommandItem
                    key={card.id}
                    onSelect={() => handleSearch(card.name)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {card.images?.small && (
                      <img
                        src={card.images.small}
                        alt={card.name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                    <div>
                      <div className="font-medium">{card.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {card.set.name} ({card.set.series})
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}