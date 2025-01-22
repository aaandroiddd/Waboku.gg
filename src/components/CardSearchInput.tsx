import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { Card } from "@/components/ui/card";

interface CardSearchInputProps {
  placeholder?: string;
  onSelect?: (cardName: string) => void;
  onSearch?: (query: string) => void;
}

const CardSearchInput: React.FC<CardSearchInputProps> = ({ 
  placeholder = "Search cards...",
  onSelect,
  onSearch 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { trendingSearches, loading, recordSearch } = useTrendingSearches();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (term: string = searchTerm) => {
    if (term.trim()) {
      recordSearch(term.trim());
      if (onSearch) {
        onSearch(term);
      }
      if (onSelect) {
        onSelect(term);
      }
      setIsFocused(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleTrendingClick = (term: string) => {
    setSearchTerm(term);
    handleSearch(term);
  };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          value={searchTerm}
          className="pl-9 w-full"
        />
      </div>

      {isFocused && !loading && trendingSearches.length > 0 && (
        <Card ref={dropdownRef} className="absolute w-full mt-1 p-2 z-50 shadow-lg">
          <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Trending Searches</span>
          </div>
          <div className="mt-2">
            {trendingSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => handleTrendingClick(search.term)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent rounded-md transition-colors"
              >
                {search.term}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default CardSearchInput;