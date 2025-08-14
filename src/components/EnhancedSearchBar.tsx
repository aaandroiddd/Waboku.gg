import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Search, Loader2, ShoppingBag, Clock, MapPin } from "lucide-react";
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { addSearchTerm, getHistorySuggestions } from '@/lib/search-history';
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
  type: 'search' | 'card' | 'set' | 'history' | 'listing';
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
}

const EnhancedSearchBar: React.FC<EnhancedSearchBarProps> = ({ 
  placeholder = "Search for cards, sets, or listings...",
  onSearch,
  showSearchButton = false,
  initialValue = "",
  isLoading = false,
  selectedState = "all",
  onSelect
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
  const router = useRouter();
  const { recordSearch } = useTrendingSearches();

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
    }, 200); // Faster response for better UX

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchSuggestions = async (query: string) => {
    try {
      // Get local search history first (fast)
      const historySuggestions = getHistorySuggestions(query, user?.uid, 2);
      const historyItems: SearchSuggestion[] = historySuggestions.map(item => ({
        text: item.term,
        type: 'history',
        score: item.count * 10,
        metadata: { count: item.count }
      }));

      // Fetch both card suggestions and listing suggestions in parallel
      const [cardSuggestions, listingSuggestions] = await Promise.all([
        // Get card suggestions (existing API)
        fetch(`/api/search/card-suggestions?q=${encodeURIComponent(query)}&limit=4`)
          .then(r => r.json())
          .catch(() => []),
        // Get real-time listing suggestions (new API)
        fetch(`/api/search/listing-suggestions?q=${encodeURIComponent(query)}&limit=6`)
          .then(r => r.json())
          .catch(() => [])
      ]);

      // Convert card suggestions to SearchSuggestion format
      const cardItems: SearchSuggestion[] = cardSuggestions.map((text: string) => ({
        text,
        type: 'card',
        score: 50
      }));

      // Convert listing suggestions to SearchSuggestion format
      const listingItems: SearchSuggestion[] = listingSuggestions.map((listing: ListingSuggestion) => ({
        text: listing.title,
        type: 'listing',
        score: listing.score,
        metadata: {
          id: listing.id,
          price: listing.price,
          game: listing.game,
          condition: listing.condition,
          city: listing.city,
          state: listing.state,
          imageUrl: listing.imageUrl,
          url: listing.url // Include the new short URL format
        }
      }));

      // Combine all suggestions
      const allSuggestions = [...historyItems, ...cardItems, ...listingItems];
      
      // Remove duplicates and sort by score
      const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text.toLowerCase() === suggestion.text.toLowerCase())
      );

      const sortedSuggestions = uniqueSuggestions
        .sort((a, b) => {
          // Prioritize listings, then history, then cards
          const typeOrder = { listing: 3, history: 2, card: 1, search: 1, set: 1 };
          const aTypeScore = typeOrder[a.type] || 0;
          const bTypeScore = typeOrder[b.type] || 0;
          
          if (aTypeScore !== bTypeScore) {
            return bTypeScore - aTypeScore;
          }
          
          return (b.score || 0) - (a.score || 0);
        })
        .slice(0, 8);

      setSuggestions(sortedSuggestions);
      setShowSuggestions(sortedSuggestions.length > 0);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      
      // Fallback to history only
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
    if (suggestion.type === 'listing' && suggestion.metadata?.url) {
      // Navigate directly to the listing using the new short URL format
      router.push(suggestion.metadata.url);
    } else if (suggestion.type === 'listing' && suggestion.metadata?.id) {
      // Fallback to old format if URL is not available
      router.push(`/listings/${suggestion.metadata.id}`);
    } else {
      // Handle as regular search
      setSearchTerm(suggestion.text);
      if (onSelect && suggestion.type === 'card') {
        onSelect(suggestion.text);
      } else {
        await handleSearch(suggestion.text);
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

  const getSuggestionIcon = (suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'listing':
        return <ShoppingBag className="h-4 w-4 text-green-600" />;
      case 'history':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'card':
        return '🃏';
      case 'set':
        return '📦';
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
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

      {/* Enhanced suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-2 bg-popover/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl max-h-80 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.text}-${suggestion.metadata?.id || index}`}
              className={`px-4 py-3 cursor-pointer hover:bg-accent/80 flex items-center gap-3 transition-colors duration-150 ${
                index === selectedIndex ? 'bg-accent/80' : ''
              } ${index === 0 ? 'rounded-t-lg' : ''} ${index === suggestions.length - 1 ? 'rounded-b-lg' : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex-shrink-0">
                {suggestion.metadata?.imageUrl ? (
                  <img 
                    src={suggestion.metadata.imageUrl} 
                    alt={suggestion.text}
                    className="w-8 h-8 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  getSuggestionIcon(suggestion)
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{suggestion.text}</span>
                  {suggestion.metadata?.price && (
                    <span className="text-sm font-bold text-green-600 ml-2">
                      {formatPrice(suggestion.metadata.price)}
                    </span>
                  )}
                </div>
                
                {suggestion.type === 'listing' && suggestion.metadata && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{suggestion.metadata.condition}</span>
                    <span>•</span>
                    <span>{suggestion.metadata.game}</span>
                    {suggestion.metadata.city && suggestion.metadata.state && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{suggestion.metadata.city}, {suggestion.metadata.state}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex-shrink-0">
                <span className="text-xs text-muted-foreground/70 capitalize font-medium">
                  {suggestion.type === 'listing' ? 'listing' : suggestion.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchBar;