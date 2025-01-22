import React from 'react';
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (onSelect) {
      onSelect(value);
    }
    if (onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        onChange={handleChange}
        className="pl-9 h-10"
      />
    </div>
  );
};

export default CardSearchInput;