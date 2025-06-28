import { Input } from "@/components/ui/input";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSelect } from "@/components/ui/mobile-select";
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
                <MobileSelect 
                  value={gameFilter} 
                  onValueChange={onGameFilterChange}
                  placeholder="All Games"
                  options={[
                    { value: "all", label: "All Games" },
                    { value: "dbs", label: "Dragon Ball Super Card Game" },
                    { value: "digimon", label: "Digimon" },
                    { value: "lorcana", label: "Disney Lorcana" },
                    { value: "flesh-and-blood", label: "Flesh and Blood" },
                    { value: "mtg", label: "Magic: The Gathering" },
                    { value: "onepiece", label: "One Piece Card Game" },
                    { value: "pokemon", label: "Pokemon" },
                    { value: "star-wars", label: "Star Wars: Unlimited" },
                    { value: "union-arena", label: "Union Arena" },
                    { value: "universus", label: "Universus" },
                    { value: "vanguard", label: "Vanguard" },
                    { value: "weiss", label: "Weiss Schwarz" },
                    { value: "yugioh", label: "Yu-Gi-Oh!" },
                    { value: "other", label: "Other" }
                  ]}
                />
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