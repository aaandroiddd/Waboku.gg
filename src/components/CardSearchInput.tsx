import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface CardSearchInputProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CardSearchInput({ 
  onSearch,
  placeholder = "Search for Pokémon, Magic, or One Piece cards...",
  className = ""
}: CardSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full">
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearch) {
              onSearch(searchQuery);
            }
          }}
          className="pl-10 h-12 w-full"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}