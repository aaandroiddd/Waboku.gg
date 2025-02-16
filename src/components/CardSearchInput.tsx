import React, { useState, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { useToast } from "@/components/ui/use-toast";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSearch = (term: string = searchTerm) => {
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

    if (normalizedTerm.trim()) {
      if (onSearch) {
        onSearch(normalizedTerm);
      }
      if (onSelect) {
        onSelect(normalizedTerm);
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
        <Search 
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" 
          onClick={() => handleSearch()}
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          value={searchTerm}
          className="pl-9 pr-12 w-full"
        />
        <button
          onClick={() => handleSearch()}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 w-8"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CardSearchInput;