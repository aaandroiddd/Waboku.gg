import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { addSearchTerm } from '@/lib/search-history';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';

interface ListingSuggestion {
  id: string;
  title: string;
  price: number;
  game: string;
  condition: string;
  city: string;
  state: string;
  imageUrl?: string;
  type: 'listing';
  score: number;
  url: string; // Add URL field for new short URL format
}

interface SearchSuggestion {
  text: string;
  type: 'search' | 'card' | 'set' | 'history' | 'listing' | 'wanted';
  score?: number;
  metadata?: {
    clickRate?: number;
    avgPosition?: number;
    refinementCount?: number;
    recentPopularity?: number;
    count?: number;
    // Listing-specific metadata
    id?: string;
    price?: number;
    game?: string;
    condition?: string;
    city?: string;
    state?: string;
    imageUrl?: string;
    url?: string; // Add URL field for new short URL format
  };
}

interface EnhancedSearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showSearchButton?: boolean;
  initialValue?: string;
  isLoading?: boolean;
  selectedState?: string;
  onSelect?: (cardName: string) => void;
  suggestionsEndpoint?: string; // configurable suggestions API
  suggestionsLimit?: number; // configurable limit
}

const EnhancedSearchBar: React.FC<EnhancedSearchBarProps> = ({ 
  placeholder = "Search for cards, sets, or listings...",
  onSearch,
  showSearchButton = false,
  initialValue = "",
  isLoading = false,
  selectedState = "all",
  onSelect,
  suggestionsEndpoint = "/api/search/listing-suggestions",
  suggestionsLimit = 8
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const { recordSearch } = useTrendingSearches();

  // Track user interaction for suggestions
  const hasUserInteracted = useRef(false);

  // Prefetch cache to avoid duplicate prefetches
  const prefetched = useRef<Set<string>>(new Set());

  const prefetchSuggestionRoute = (s: SearchSuggestion) => {
    const href = s.metadata?.url;
    if (!href) return;
    if (prefetched.current.has(href)) return;
    prefetched.current.add(href);
    // Best-effort prefetch; ignore errors
    router.prefetch(href).catch(() => {});
  };

  // Reset interaction state after route changes to prevent auto-opening suggestions
  useEffect(() => {
    const handleRouteDone = () => {
      hasUserInteracted.current = false;
      setShowSuggestions(false);
      setSelectedIndex(-1);
    };
    router.events.on('routeChangeComplete', handleRouteDone);
    return () => {
      router.events.off('routeChangeComplete', handleRouteDone);
    };
  }, [router.events]);

  // Update searchTerm when initialValue changes
  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  // Debounced search for suggestions (user-initiated only)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2 && hasUserInteracted.current) {
        fetchSuggestions(searchTerm);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setHasSearched(false);
        setIsFetchingSuggestions(false);
      }
    }, 400); // 400ms debounce to prevent immediate suggestions after navigation

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchSuggestions = async (query: string) => {
    setIsFetchingSuggestions(true);
    setHasSearched(true);
    setShowSuggestions(true); // Show dropdown immediately to display loading state
    
    try {
      const items = await fetch(`${suggestionsEndpoint}?q=${encodeURIComponent(query)}&limit=${suggestionsLimit}`)
        .then(r => r.json())
        .catch(() => []);

      const mapped: SearchSuggestion[] = items.map((item: any) => ({
        text: item.title,
        type: (item.type as any) || 'listing',
        score: item.score,
        metadata: {
          id: item.id,
          url: item.url,
          imageUrl: item.imageUrl,
          game: item.game
        }
      }));

      setSuggestions(mapped);
      setShowSuggestions(true); // Keep showing dropdown even if no results to show "no results" message
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(true); // Still show dropdown to display error/no results
    } finally {
      setIsFetchingSuggestions(false);
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
        console.log(`[EnhancedSearchBar] Recorded search term in local history: "${trimmedTerm}"`);
      } catch (error) {
        console.error('[EnhancedSearchBar] Error recording search term in local history:', error);
      }
    }

    if (onSearch) {
      setIsSearching(true);
      try {
        await onSearch(trimmedTerm);
      } catch (error) {
        console.error('[EnhancedSearchBar] Error executing search:', error);
        toast({
          title: "Search Error",
          description: "An error occurred while searching. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsSearching(false);
      }
    } else {
      // Default search behavior - navigate to listings page
      try {
        if (trimmedTerm) {
          await recordSearch(trimmedTerm);
        }
        
        const currentQuery = router.query;
        const newQuery: any = { ...currentQuery };
        
        if (trimmedTerm) {
          newQuery.query = trimmedTerm;
        } else {
          delete newQuery.query;
        }
        
        if (selectedState !== 'all') {
          newQuery.state = selectedState;
        }
        
        router.push({
          pathname: '/listings',
          query: newQuery
        });
      } catch (error) {
        console.error('Error navigating to search results:', error);
      }
    }
  };

  const handleSuggestionClick = async (suggestion: SearchSuggestion) => {
    if (suggestion.metadata?.url) {
      // Navigate directly if a URL is provided (works for listings and wanted posts)
      router.push(suggestion.metadata.url);
      return;
    } 
    if (suggestion.type === 'listing' && suggestion.metadata?.id) {
      // Fallback to old listing format if URL is not available
      router.push(`/listings/${suggestion.metadata.id}`);
      return;
    }
    // Handle as regular search
    setSearchTerm(suggestion.text);
    if (onSelect && suggestion.type === 'card') {
      onSelect(suggestion.text);
    } else {
      await handleSearch(suggestion.text);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    hasUserInteracted.current = true;
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
          handleSuggestionClick(selectedSuggestion);
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

  const handleBlur = (e: React.FocusEvent) => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 150);
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
            if (suggestions.length > 0 && hasUserInteracted.current) {
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

      {/* Suggestions dropdown with loading and no results states */}
      {showSuggestions && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-2 bg-popover/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl max-h-80 overflow-y-auto text-left"
        >
          {isFetchingSuggestions ? (
            // Loading state
            <div className="px-4 py-6 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            </div>
          ) : suggestions.length > 0 ? (
            // Show suggestions
            suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${suggestion.text}-${suggestion.metadata?.id || index}`}
                className={`px-4 py-3 cursor-pointer hover:bg-accent/80 transition-colors duration-150 ${
                  index === selectedIndex ? 'bg-accent/80' : ''
                } ${index === 0 ? 'rounded-t-lg' : ''} ${index === suggestions.length - 1 ? 'rounded-b-lg' : ''}`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => { setSelectedIndex(index); prefetchSuggestionRoute(suggestion); }}
                onFocus={() => prefetchSuggestionRoute(suggestion)}
              >
                <div className="flex items-start gap-3">
                  {suggestion.metadata?.imageUrl ? (
                    <img
                      src={suggestion.metadata!.imageUrl as string}
                      alt={suggestion.text}
                      className="h-10 w-10 rounded-md object-cover border border-border/50 bg-muted"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0 text-left">
                    <div className="text-sm font-medium truncate">{suggestion.text}</div>
                    {suggestion.metadata?.game ? (
                      <div className="text-xs text-muted-foreground truncate">
                        {suggestion.metadata.game.charAt(0).toUpperCase() + suggestion.metadata.game.slice(1)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : hasSearched ? (
            // No results found
            <div className="px-4 py-6 text-center">
              <div className="text-sm text-muted-foreground">
                <div className="font-medium mb-1">No listings found</div>
                <div className="text-xs">Try a different search term or check your spelling</div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchBar;