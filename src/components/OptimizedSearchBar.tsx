import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/router';
import { useOptimizedSearch, usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';
import { Listing } from '@/types/database';

interface OptimizedSearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  showSuggestions?: boolean;
  showTrending?: boolean;
  className?: string;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'trending' | 'suggestion';
  count?: number;
}

export function OptimizedSearchBar({
  onSearch,
  placeholder = "Search for cards, games, or sellers...",
  showSuggestions = true,
  showTrending = true,
  className = ""
}: OptimizedSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Use performance optimization
  const { debounce, measureRender } = usePerformanceOptimization({
    componentName: 'OptimizedSearchBar',
    trackRenders: true
  });

  // Mock search function - replace with actual search implementation
  const searchFunction = useCallback(async (searchQuery: string): Promise<SearchSuggestion[]> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock suggestions based on query
    const mockSuggestions: SearchSuggestion[] = [
      { id: '1', text: `${searchQuery} cards`, type: 'suggestion' },
      { id: '2', text: `${searchQuery} booster packs`, type: 'suggestion' },
      { id: '3', text: `${searchQuery} singles`, type: 'suggestion' },
    ].filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase()));

    return mockSuggestions;
  }, []);

  // Use optimized search hook
  const { results: searchSuggestions, isLoading: isSearching } = useOptimizedSearch(
    searchFunction,
    300 // 300ms debounce
  );

  // Load recent searches from localStorage
  useEffect(() => {
    const loadRecentSearches = () => {
      try {
        const recent = localStorage.getItem('recent_searches');
        if (recent) {
          setRecentSearches(JSON.parse(recent).slice(0, 5));
        }
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    };

    loadRecentSearches();
  }, []);

  // Load trending searches
  useEffect(() => {
    const loadTrendingSearches = async () => {
      try {
        // Mock trending searches - replace with actual API call
        const trending: SearchSuggestion[] = [
          { id: 't1', text: 'Pokemon cards', type: 'trending', count: 1250 },
          { id: 't2', text: 'Magic the Gathering', type: 'trending', count: 980 },
          { id: 't3', text: 'Yu-Gi-Oh singles', type: 'trending', count: 750 },
          { id: 't4', text: 'Charizard', type: 'trending', count: 650 },
          { id: 't5', text: 'Black Lotus', type: 'trending', count: 420 },
        ];
        setTrendingSearches(trending);
      } catch (error) {
        console.error('Error loading trending searches:', error);
      }
    };

    if (showTrending) {
      loadTrendingSearches();
    }
  }, [showTrending]);

  // Debounced search suggestions
  const debouncedGetSuggestions = useCallback(
    debounce((searchQuery: string) => {
      if (searchQuery.trim().length > 1) {
        // This will trigger the useOptimizedSearch hook
        searchFunction(searchQuery);
      } else {
        setSuggestions([]);
      }
    }, 300),
    [searchFunction]
  );

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    measureRender(() => {
      if (value.trim().length > 1) {
        debouncedGetSuggestions(value);
      } else {
        setSuggestions([]);
      }
    });
  }, [debouncedGetSuggestions, measureRender]);

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    measureRender(() => {
      // Save to recent searches
      const updatedRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
      setRecentSearches(updatedRecent);
      localStorage.setItem('recent_searches', JSON.stringify(updatedRecent));

      // Close suggestions
      setIsFocused(false);
      
      // Call search callback or navigate
      if (onSearch) {
        onSearch(searchQuery);
      } else {
        router.push(`/listings?search=${encodeURIComponent(searchQuery)}`);
      }
    });
  }, [recentSearches, onSearch, router, measureRender]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  }, [query, handleSearch]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion | string) => {
    const searchText = typeof suggestion === 'string' ? suggestion : suggestion.text;
    setQuery(searchText);
    handleSearch(searchText);
  }, [handleSearch]);

  // Handle clear
  const handleClear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur with delay to allow suggestion clicks
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Combine all suggestions
  const allSuggestions = [
    ...searchSuggestions.map(s => ({ ...s, type: 'suggestion' as const })),
    ...suggestions
  ];

  const showSuggestionsPanel = isFocused && showSuggestions && (
    allSuggestions.length > 0 || 
    recentSearches.length > 0 || 
    (trendingSearches.length > 0 && query.length === 0)
  );

  return (
    <div className={`relative w-full ${className}`}>
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </form>

      {/* Suggestions Panel */}
      {showSuggestionsPanel && (
        <Card 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto shadow-lg"
        >
          <CardContent className="p-2">
            {/* Search Suggestions */}
            {allSuggestions.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Suggestions
                </div>
                {allSuggestions.slice(0, 5).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-2 py-2 text-sm hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                  >
                    <Search className="h-3 w-3 text-muted-foreground" />
                    <span>{suggestion.text}</span>
                    {isSearching && <div className="ml-auto w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />}
                  </button>
                ))}
              </div>
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && query.length === 0 && (
              <div className="space-y-1 mt-3">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent Searches
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(search)}
                    className="w-full text-left px-2 py-2 text-sm hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{search}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Trending Searches */}
            {trendingSearches.length > 0 && query.length === 0 && (
              <div className="space-y-1 mt-3">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Trending
                </div>
                {trendingSearches.slice(0, 5).map((trending) => (
                  <button
                    key={trending.id}
                    onClick={() => handleSuggestionClick(trending)}
                    className="w-full text-left px-2 py-2 text-sm hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                  >
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span>{trending.text}</span>
                    {trending.count && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {trending.count}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}