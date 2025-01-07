import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import CardSearchInput from './CardSearchInput';

const SearchInterface = () => {
  const [selectedState, setSelectedState] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback(() => {
    // Implement your search logic here
    console.log('Searching:', { searchQuery, selectedState });
  }, [searchQuery, selectedState]);

  return (
    <div className="flex flex-col max-w-2xl mx-auto pt-4 sm:pt-6 pb-4 sm:pb-8 px-4 sm:px-0">
      {/* Mobile Search Controls */}
      <div className="flex sm:hidden flex-col gap-4 mb-4">
        <CardSearchInput
          onSelect={setSearchQuery}
          onSearch={handleSearch}
        />
        
        <div className="flex gap-2">
          <div className="flex-1">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value.toLowerCase())}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            >
              <option value="">Select State</option>
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </div>
          <Button 
            className="h-10 px-8" 
            onClick={handleSearch}
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Desktop Search Controls */}
      <div className="hidden sm:flex gap-4">
        <div className="relative flex-1">
          <CardSearchInput
            onSelect={setSearchQuery}
            onSearch={handleSearch}
          />
        </div>
        
        <div className="flex">
          <div className="w-[180px]">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value.toLowerCase())}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            >
              <option value="">Select State</option>
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </div>
          <Button 
            className="h-10 w-10 ml-2" 
            size="icon" 
            onClick={handleSearch}
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SearchInterface;