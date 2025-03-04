import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import CardSearchInput from './CardSearchInput';
import { useToast } from "@/components/ui/use-toast";

const SearchInterface = () => {
  const [selectedState, setSelectedState] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string) => {
    if (!query) return;
    
    setSearchQuery(query);
    setDebouncedQuery(query);
    setIsLoading(true);

    try {
      // Record the search term
      await fetch('/api/search/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: query }),
      });

      // Perform the actual search
      const response = await fetch(`/api/one-piece/search?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      console.log('Search results:', data);
      
      // Here you would typically update some state with the search results
      // and display them in the UI

    } catch (error) {
      console.error('Error during search:', error);
      toast({
        title: "Search Error",
        description: "Failed to perform search. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }

  }, [selectedState, toast]);

  return (
    <div className="flex flex-col max-w-2xl mx-auto pt-4 sm:pt-6 pb-4 sm:pb-8 px-4 sm:px-0">
      {/* Mobile Search Controls */}
      <div className="flex sm:hidden flex-col gap-4 mb-4">
        <div className="w-full">
          <CardSearchInput
            onSelect={setSearchQuery}
            onSearch={handleSearch}
            isLoading={isLoading}
            showSearchButton={true}
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
            handleSearch(searchQuery);
          }} className="flex gap-4">
            <div className="flex-1">
              <CardSearchInput
                onSelect={setSearchQuery}
                onSearch={handleSearch}
                isLoading={isLoading}
              />
            </div>
            <Button type="submit" className="h-10" disabled={isLoading}>
              <Search className="h-4 w-4 mr-2" />
              {isLoading ? 'Searching...' : 'Search'}
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