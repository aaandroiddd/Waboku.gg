import React, { useState, useCallback } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Search, Loader2 } from "lucide-react";
import { useCardSearch } from '@/hooks/useCardSearch';

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
  const { results, isLoading, searchCards } = useCardSearch();

  const handleInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    searchCards(value);
  }, [searchCards]);

  const handleSelect = useCallback((card: { name: string, number?: string }) => {
    const displayName = card.number ? `${card.name} - ${card.number}` : card.name;
    setSearchQuery(displayName);
    if (onSelect) {
      onSelect(displayName);
    }
    // Also trigger search when suggestion is selected
    if (onSearch) {
      onSearch(displayName);
    }
  }, [onSelect, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchQuery);
    }
  }, [searchQuery, onSearch]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Command className="rounded-md border border-input">
          <CommandInput
            value={searchQuery}
            onValueChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            isLoading={isLoading}
          />
        </Command>
        {searchQuery && (
          <div className="absolute w-full z-50 bg-background border rounded-md mt-1 shadow-lg">
            <Command>
              <CommandGroup className="max-h-[300px] overflow-y-auto">
                {results.length === 0 && !isLoading && (
                  <CommandEmpty>No results found</CommandEmpty>
                )}
                {results.map((card, index) => (
                  <CommandItem
                    key={`${card.identifier}-${index}`}
                    value={card.name}
                    onSelect={() => handleSelect(card)}
                    className="px-4 py-2"
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
                        <p className="font-medium">
                          {card.name}
                          {card.number && <span className="text-muted-foreground ml-1">- {card.number}</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">{card.set.name}</p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardSearchInput;