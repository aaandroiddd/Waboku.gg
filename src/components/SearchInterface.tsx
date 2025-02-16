import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import CardSearchInput from './CardSearchInput';

const SearchInterface = () => {
  const [selectedState, setSelectedState] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSearch = useCallback(() => {
    setDebouncedQuery(searchQuery);
    // Implement your search logic here
    console.log('Searching:', { searchQuery, selectedState });
  }, [searchQuery, selectedState]);

  return (
    <div className="flex flex-col max-w-2xl mx-auto pt-4 sm:pt-6 pb-4 sm:pb-8 px-4 sm:px-0">
      {/* Mobile Search Controls */}
      <div className="flex sm:hidden flex-col gap-4 mb-4">
        <div className="w-full">
          <CardSearchInput
            onSelect={setSearchQuery}
            onSearch={handleSearch}
          />
        </div>
        
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
      </div>

      {/* Desktop Search Controls */}
      <div className="hidden sm:flex gap-4">
        <div className="flex-1">
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }} className="flex gap-4">
            <div className="flex-1">
              <CardSearchInput
                onSelect={setSearchQuery}
                onSearch={handleSearch}
              />
            </div>
            <Button type="submit" className="h-10">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </div>
        
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
      </div>
    </div>
  );
};

export default SearchInterface;