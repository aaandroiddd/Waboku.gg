import React, { useState, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Loader2 } from "lucide-react";
import useCardSearch from '@/hooks/useCardSearch';

interface CardSearchInputProps {
  placeholder?: string;
  onSelect?: (cardName: string) => void;
  onSearch?: (query: string) => void;
}

const CardSearchInput: React.FC<CardSearchInputProps> = ({ 
  placeholder = "Search for cards...",
  onSelect,
  onSearch 
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isLoading, searchCards } = useCardSearch();

  const handleInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    searchCards(value);
    setIsPopoverOpen(true);
  }, [searchCards]);

  const handleSelect = useCallback((cardName: string) => {
    setSearchQuery(cardName);
    setIsPopoverOpen(false);
    if (onSelect) {
      onSelect(cardName);
    }
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchQuery);
      setIsPopoverOpen(false);
    }
  }, [searchQuery, onSearch]);

  return (
    <Popover 
      open={isPopoverOpen} 
      onOpenChange={setIsPopoverOpen}
    >
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow duration-200 ease-in-out focus-within:shadow-lg"
            autoComplete="off"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            {isLoading && searchQuery.trim() ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </div>
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-full p-0" 
        align="start"
        sideOffset={4}
      >
        <div className="max-h-[300px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((card, index) => (
                <button
                  key={`${card.identifier}-${index}`}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800"
                  onClick={() => handleSelect(card.name)}
                >
                  <div className="flex items-center gap-2">
                    {card.images.small && (
                      <img 
                        src={card.images.small} 
                        alt={card.name} 
                        className="w-8 h-8 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium">{card.name}</p>
                      <p className="text-sm text-gray-500">{card.set.name}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.trim() && !isLoading ? (
            <div className="p-4 text-center text-gray-500">
              No results found
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CardSearchInput;