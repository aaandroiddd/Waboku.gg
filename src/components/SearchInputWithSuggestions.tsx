import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { addSearchTerm, getHistorySuggestions } from '@/lib/search-history';
import { useAuth } from '@/contexts/AuthContext';

interface SearchSuggestion {
  text: string;
  type: 'search' | 'card' | 'set' | 'history';
  score?: number;
  metadata?: {
    clickRate?: number;
    avgPosition?: number;
    refinementCount?: number;
    recentPopularity?: number;
    count?: number; // For history entries
  };
}

interface SearchInputWithSuggestionsProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showSearchButton?: boolean;
  initialValue?: string;
  isLoading?: boolean;
}

const SearchInputWithSuggestions: React.FC<SearchInputWithSuggestionsProps> = ({ 
  placeholder = "Search cards...",
  onSearch,
  showSearchButton = false,
  initialValue = "",
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Update searchTerm when initialValue changes
  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        fetchSuggestions(searchTerm);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchSuggestions = async (query: string) => {
    try {
      // Get local search history first (fast)
      const historySuggestions = getHistorySuggestions(query, user?.uid, 3);
      const historyItems: SearchSuggestion[] = historySuggestions.map(item => ({
        text: item.term,
        type: 'history',
        score: item.count * 10, // Boost history items
        metadata: { count: item.count }
      }));

      // Use intelligent suggestions that incorporate user behavior analytics
      const intelligentSuggestions = await fetch(
        `/api/search/intelligent-suggestions?q=${encodeURIComponent(query)}&limit=6`
      ).then(r => r.json());

      const apiSuggestions: SearchSuggestion[] = intelligentSuggestions.map((suggestion: any) => ({
        text: suggestion.text,
        type: suggestion.type === 'behavioral' ? 'search' : 
              suggestion.type === 'popular' ? 'card' : 
              suggestion.type === 'refinement' ? 'search' : 'card',
        score: suggestion.score,
        metadata: suggestion.metadata
      }));

      // Combine history and API suggestions, removing duplicates
      const allSuggestions = [...historyItems, ...apiSuggestions];
      const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text.toLowerCase() === suggestion.text.toLowerCase())
      );

      // Sort by score and limit to 8
      const sortedSuggestions = uniqueSuggestions
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8);

      setSuggestions(sortedSuggestions);
      setShowSuggestions(sortedSuggestions.length > 0);
    } catch (error) {
      console.error('Error fetching intelligent suggestions:', error);
      
      // Fallback to basic suggestions + history
      try {
        const historySuggestions = getHistorySuggestions(query, user?.uid, 3);
        const historyItems: SearchSuggestion[] = historySuggestions.map(item => ({
          text: item.term,
          type: 'history',
          score: item.count * 10,
          metadata: { count: item.count }
        }));

        const [searchSuggestions, cardSuggestions] = await Promise.all([
          fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`).then(r => r.json()),
          fetch(`/api/search/card-suggestions?q=${encodeURIComponent(query)}`).then(r => r.json())
        ]);

        const apiSuggestions: SearchSuggestion[] = [
          ...searchSuggestions.map((text: string) => ({ text, type: 'search' as const, score: 1 })),
          ...cardSuggestions.map((text: string) => ({ text, type: 'card' as const, score: 1 }))
        ];

        // Combine and deduplicate
        const allSuggestions = [...historyItems, ...apiSuggestions];
        const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) => 
          index === self.findIndex(s => s.text.toLowerCase() === suggestion.text.toLowerCase())
        );

        setSuggestions(uniqueSuggestions.slice(0, 8));
        setShowSuggestions(uniqueSuggestions.length > 0);
      } catch (fallbackError) {
        console.error('Error fetching fallback suggestions:', fallbackError);
        
        // Last resort: just show history
        const historySuggestions = getHistorySuggestions(query, user?.uid, 8);
        const historyItems: SearchSuggestion[] = historySuggestions.map(item => ({
          text: item.term,
          type: 'history',
          score: item.count * 10,
          metadata: { count: item.count }
        }));
        
        setSuggestions(historyItems);
        setShowSuggestions(historyItems.length > 0);
      }
    }
  };

  const handleSearch = async (term: string = searchTerm) => {
    const trimmedTerm = term.trim();
    const normalizedTerm = normalizeSearchTerm(trimmedTerm);
    
    if (normalizedTerm && !validateSearchTerm(normalizedTerm)) {
      toast({
        title: "Invalid search term",
        description: "Please enter a valid search term using letters and numbers.",
        variant: "destructive"
      });
      return;
    }

    // Hide suggestions immediately
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Record search term in local history if it's not empty
    if (trimmedTerm) {
      try {
        addSearchTerm(trimmedTerm, user?.uid);
        console.log(`[SearchInput] Recorded search term in local history: "${trimmedTerm}"`);
      } catch (error) {
        console.error('[SearchInput] Error recording search term in local history:', error);
      }
    }

    if (onSearch) {
      setIsSearching(true);
      try {
        await onSearch(trimmedTerm);
      } catch (error) {
        console.error('[SearchInput] Error executing search:', error);
        toast({
          title: "Search Error",
          description: "An error occurred while searching. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          const selectedSuggestion = suggestions[selectedIndex];
          setSearchTerm(selectedSuggestion.text);
          handleSearch(selectedSuggestion.text);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setSearchTerm(suggestion.text);
    handleSearch(suggestion.text);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 150);
  };

  const getSuggestionIcon = (suggestion: SearchSuggestion) => {
    // Show different icons based on suggestion quality/type
    if (suggestion.metadata?.clickRate && suggestion.metadata.clickRate > 5) {
      return '⭐'; // High-performing suggestion
    }
    if (suggestion.metadata?.refinementCount && suggestion.metadata.refinementCount > 3) {
      return '🎯'; // Popular refinement
    }
    
    switch (suggestion.type) {
      case 'history':
        return '🕒'; // Clock icon for search history
      case 'search':
        return '🔍';
      case 'card':
        return '🃏';
      case 'set':
        return '📦';
      default:
        return '🔍';
    }
  };

  return (
    <div className="relative flex-1">
      <div className="relative flex items-center shadow-lg rounded-lg bg-background/95 backdrop-blur-sm border border-border/50 hover:shadow-xl transition-shadow duration-300">
        {(isSearching || isLoading) ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
        ) : null}
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          value={searchTerm}
          className={`${(isSearching || isLoading) ? 'pl-9' : 'pl-4'} pr-4 w-full border-0 bg-transparent focus:ring-0 focus:outline-none text-base h-12 ${showSearchButton ? 'rounded-r-none' : 'rounded-lg'} placeholder:text-muted-foreground/70`}
          disabled={isSearching || isLoading}
        />
        {showSearchButton && (
          <Button 
            type="button"
            onClick={() => handleSearch(searchTerm)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg px-6 py-2 rounded-l-none h-12 border-l border-border/30"
            disabled={isSearching || isLoading}
          >
            {(isSearching || isLoading) ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-2 bg-popover/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.text}`}
              className={`px-4 py-3 cursor-pointer hover:bg-accent/80 flex items-center gap-3 transition-colors duration-150 ${
                index === selectedIndex ? 'bg-accent/80' : ''
              } ${index === 0 ? 'rounded-t-lg' : ''} ${index === suggestions.length - 1 ? 'rounded-b-lg' : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="text-sm">{getSuggestionIcon(suggestion)}</span>
              <div className="flex-1">
                <span className="text-sm font-medium">{suggestion.text}</span>
                {suggestion.metadata?.clickRate && suggestion.metadata.clickRate > 3 && (
                  <span className="ml-2 text-xs text-green-600 font-medium">Popular</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground/70 capitalize font-medium">
                {suggestion.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchInputWithSuggestions;