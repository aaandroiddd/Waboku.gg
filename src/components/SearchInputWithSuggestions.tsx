import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

interface SearchSuggestion {
  text: string;
  type: 'search' | 'card' | 'set';
  score?: number;
  metadata?: {
    clickRate?: number;
    avgPosition?: number;
    refinementCount?: number;
    recentPopularity?: number;
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
      // Use intelligent suggestions that incorporate user behavior analytics
      const intelligentSuggestions = await fetch(
        `/api/search/intelligent-suggestions?q=${encodeURIComponent(query)}&limit=8`
      ).then(r => r.json());

      const suggestions: SearchSuggestion[] = intelligentSuggestions.map((suggestion: any) => ({
        text: suggestion.text,
        type: suggestion.type === 'behavioral' ? 'search' : 
              suggestion.type === 'popular' ? 'card' : 
              suggestion.type === 'refinement' ? 'search' : 'card',
        score: suggestion.score,
        metadata: suggestion.metadata
      }));

      setSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Error fetching intelligent suggestions:', error);
      
      // Fallback to basic suggestions
      try {
        const [searchSuggestions, cardSuggestions] = await Promise.all([
          fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`).then(r => r.json()),
          fetch(`/api/search/card-suggestions?q=${encodeURIComponent(query)}`).then(r => r.json())
        ]);

        const combined: SearchSuggestion[] = [
          ...searchSuggestions.map((text: string) => ({ text, type: 'search' as const })),
          ...cardSuggestions.map((text: string) => ({ text, type: 'card' as const }))
        ];

        setSuggestions(combined.slice(0, 8));
        setShowSuggestions(combined.length > 0);
      } catch (fallbackError) {
        console.error('Error fetching fallback suggestions:', fallbackError);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const handleSearch = async (term: string = searchTerm) => {
    const normalizedTerm = normalizeSearchTerm(term);
    
    if (normalizedTerm && !validateSearchTerm(normalizedTerm)) {
      toast({
        title: "Invalid search term",
        description: "Please enter a valid search term using letters and numbers.",
        variant: "destructive"
      });
      return;
    }

    setShowSuggestions(false);
    setSelectedIndex(-1);

    if (onSearch) {
      setIsSearching(true);
      try {
        await onSearch(term.trim());
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
      <div className="relative flex items-center">
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
          className={`${(isSearching || isLoading) ? 'pl-9' : 'pl-4'} pr-4 w-full ${showSearchButton ? 'rounded-r-none' : ''}`}
          disabled={isSearching || isLoading}
        />
        {showSearchButton && (
          <Button 
            type="button"
            onClick={() => handleSearch(searchTerm)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 px-4 py-2 rounded-l-none h-12"
            disabled={isSearching || isLoading}
          >
            {(isSearching || isLoading) ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.text}`}
              className={`px-3 py-2 cursor-pointer hover:bg-accent flex items-center gap-2 ${
                index === selectedIndex ? 'bg-accent' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="text-sm">{getSuggestionIcon(suggestion)}</span>
              <div className="flex-1">
                <span>{suggestion.text}</span>
                {suggestion.metadata?.clickRate && suggestion.metadata.clickRate > 3 && (
                  <span className="ml-2 text-xs text-green-600">Popular</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">
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