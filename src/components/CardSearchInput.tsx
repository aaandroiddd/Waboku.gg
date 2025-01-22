import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface CardSearchInputProps {
  placeholder?: string;
  onSelect?: (cardName: string) => void;
  onSearch?: (query: string) => void;
  minSearchLength?: number;
  debounceMs?: number;
}

const CardSearchInput: React.FC<CardSearchInputProps> = ({ 
  placeholder = "Search cards...",
  onSelect,
  onSearch,
  minSearchLength = 3,
  debounceMs = 500
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const triggerSearch = useCallback((value: string) => {
    if (value.length >= minSearchLength) {
      if (onSearch) {
        onSearch(value);
      }
      if (onSelect) {
        onSelect(value);
      }
    }
  }, [onSearch, onSelect, minSearchLength]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        triggerSearch(searchTerm);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs, triggerSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch(searchTerm);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        value={searchTerm}
        className="pl-9"
      />
    </div>
  );
};

export default CardSearchInput;