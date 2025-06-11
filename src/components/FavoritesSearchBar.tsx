import { Input } from "@/components/ui/input";
import { Search, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { MAIN_GAME_CATEGORIES, OTHER_GAME_CATEGORIES, GAME_MAPPING, OTHER_GAME_MAPPING } from "@/lib/game-mappings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FavoritesSearchBarProps {
  onSearch: (value: string) => void;
  onFilterChange: (filters: FavoriteFilters) => void;
}

export interface FavoriteFilters {
  game?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
}

export function FavoritesSearchBar({ 
  onSearch, 
  onFilterChange
}: FavoritesSearchBarProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedGame, setSelectedGame] = useState<string | undefined>(undefined);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Check if any filters are active
  const hasActiveFilters = selectedGame || minPrice || maxPrice || searchValue;

  // Update filters when selections change
  useEffect(() => {
    const filters: FavoriteFilters = {};
    const newActiveFilters: string[] = [];
    
    if (selectedGame && selectedGame !== "all-games") {
      filters.game = selectedGame;
      
      // Find the display name for the game
      const mainGameEntry = Object.entries(GAME_MAPPING).find(([_, value]) => value === selectedGame);
      const otherGameEntry = Object.entries(OTHER_GAME_MAPPING).find(([_, value]) => value === selectedGame);
      const gameName = mainGameEntry ? mainGameEntry[0] : otherGameEntry ? otherGameEntry[0] : selectedGame;
      
      newActiveFilters.push(`Game: ${gameName}`);
    }
    
    if (minPrice || maxPrice) {
      filters.priceRange = {};
      
      if (minPrice) {
        filters.priceRange.min = parseFloat(minPrice);
        newActiveFilters.push(`Min: $${minPrice}`);
      }
      
      if (maxPrice) {
        filters.priceRange.max = parseFloat(maxPrice);
        newActiveFilters.push(`Max: $${maxPrice}`);
      }
    }
    
    setActiveFilters(newActiveFilters);
    onFilterChange(filters);
  }, [selectedGame, minPrice, maxPrice, onFilterChange]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearch(searchValue);
  };

  const clearFilter = (filter: string) => {
    if (filter.startsWith("Game:")) {
      setSelectedGame(undefined);
    } else if (filter.startsWith("Min:")) {
      setMinPrice("");
    } else if (filter.startsWith("Max:")) {
      setMaxPrice("");
    }
  };

  const clearAllFilters = () => {
    setSelectedGame(undefined);
    setMinPrice("");
    setMaxPrice("");
    setSearchValue("");
    onSearch("");
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearch}>
          <Input
            type="text"
            placeholder="Search favorites..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pr-10"
          />
          <Button 
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            variant="ghost"
          >
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Filters Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Filters</h4>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearAllFilters}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Game filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Game</label>
                <Select value={selectedGame} onValueChange={setSelectedGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Games" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-games">All Games</SelectItem>
                    {MAIN_GAME_CATEGORIES.map((game) => (
                      <SelectItem key={game} value={GAME_MAPPING[game]}>
                        {game}
                      </SelectItem>
                    ))}
                    {OTHER_GAME_CATEGORIES.map((game) => (
                      <SelectItem key={game} value={OTHER_GAME_MAPPING[game]}>
                        {game}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Min Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              
              {/* Max Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary" className="flex items-center gap-1">
              {filter}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1"
                onClick={() => clearFilter(filter)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}