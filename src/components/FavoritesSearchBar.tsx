import { Input } from "@/components/ui/input";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface FavoritesSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  gameFilter: string;
  onGameFilterChange: (value: string) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  onClearFilters: () => void;
}

export function FavoritesSearchBar({ 
  searchValue,
  onSearchChange,
  gameFilter,
  onGameFilterChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  onClearFilters
}: FavoritesSearchBarProps) {
  // Check if any filters are active
  const hasActiveFilters = gameFilter !== 'all' || minPrice !== '' || maxPrice !== '' || searchValue !== '';

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
            onChange={(e) => onSearchChange(e.target.value)}
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
                  onClick={onClearFilters}
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
                <Select value={gameFilter} onValueChange={onGameFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Games" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Games</SelectItem>
                    <SelectItem value="dbs">Dragon Ball Super Card Game</SelectItem>
                    <SelectItem value="digimon">Digimon</SelectItem>
                    <SelectItem value="lorcana">Disney Lorcana</SelectItem>
                    <SelectItem value="flesh-and-blood">Flesh and Blood</SelectItem>
                    <SelectItem value="mtg">Magic: The Gathering</SelectItem>
                    <SelectItem value="onepiece">One Piece Card Game</SelectItem>
                    <SelectItem value="pokemon">Pokemon</SelectItem>
                    <SelectItem value="star-wars">Star Wars: Unlimited</SelectItem>
                    <SelectItem value="union-arena">Union Arena</SelectItem>
                    <SelectItem value="universus">Universus</SelectItem>
                    <SelectItem value="vanguard">Vanguard</SelectItem>
                    <SelectItem value="weiss">Weiss Schwarz</SelectItem>
                    <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
                    onChange={(e) => onMinPriceChange(e.target.value)}
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
                    onChange={(e) => onMaxPriceChange(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}