import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

interface CardSearchInputProps {
  placeholder?: string;
  onSelect?: (cardName: string) => void;
  onSearch?: (query: string) => void;
  showSearchButton?: boolean;
  initialValue?: string;
  isLoading?: boolean;
}

const CardSearchInput: React.FC<CardSearchInputProps> = ({ 
  placeholder = "Search cards...",
  onSelect,
  onSearch,
  showSearchButton = false,
  initialValue = "",
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setIsSearching(isLoading);
  }, [isLoading]);

  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSearch = async (term: string = searchTerm) => {
    const normalizedTerm = normalizeSearchTerm(term);
    
    if (!normalizedTerm) {
      return;
    }

    if (!validateSearchTerm(normalizedTerm)) {
      toast({
        title: "Invalid search term",
        description: "Please enter a valid search term using letters and numbers.",
        variant: "destructive"
      });
      return;
    }

    // Record the search term
    try {
      await fetch('/api/search/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: normalizedTerm }),
      });
    } catch (error) {
      console.error('Failed to record search term:', error);
      // Don't show error to user as this is analytics only
    }

    if (onSearch) {
      setIsSearching(true);
      try {
        await onSearch(normalizedTerm.trim());
      } finally {
        setIsSearching(false);
      }
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

  return (
    <div className="relative flex-1">
      <div className="relative flex items-center">
        {(isSearching || isLoading) ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
        ) : (
          <Search 
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" 
            onClick={() => handleSearch(searchTerm)}
          />
        )}
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          value={searchTerm}
          className={`pl-9 pr-4 w-full ${showSearchButton ? 'rounded-r-none' : ''}`}
          disabled={isSearching || isLoading}
        />
        {showSearchButton && (
          <Button 
            onClick={() => handleSearch(searchTerm)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 px-4 py-2 rounded-l-none h-12"
            disabled={isSearching || isLoading}
          >
            {(isSearching || isLoading) ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CardSearchInput;