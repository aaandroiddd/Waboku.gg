import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { MAIN_GAME_CATEGORIES, OTHER_GAME_CATEGORIES, GAME_MAPPING, OTHER_GAME_MAPPING } from "@/lib/game-mappings";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
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

        {/* Filter button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">Filter Favorites</h4>
              
              {/* Game filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Game</label>
                <Select value={selectedGame} onValueChange={setSelectedGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select game" />
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
              
              {/* Price range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Price Range</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              
              {/* Clear filters button */}
              {activeFilters.length > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearAllFilters}
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

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