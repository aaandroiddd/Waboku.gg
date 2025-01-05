import { Button } from "@/components/ui/button";
import { Listing } from "@/types/database";
import { ListingList } from "./ListingList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingsSearchBar } from "./ListingsSearchBar";

interface ActiveListingsProps {
  listings: Listing[];
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'price' | 'title';
  sortOrder: 'asc' | 'desc';
  gameFilter: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onSortByChange: (sortBy: 'date' | 'price' | 'title') => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onGameFilterChange: (game: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMessage: (id: string) => void;
  onView: (id: string) => void;
  onShare: (id: string) => void;
}

export const ActiveListings = ({
  listings,
  viewMode,
  sortBy,
  sortOrder,
  gameFilter,
  onViewModeChange,
  onSortByChange,
  onSortOrderChange,
  onGameFilterChange,
  onEdit,
  onDelete,
  onMessage,
  onView,
  onShare,
}: ActiveListingsProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('list')}
          >
            List
          </Button>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Select value={gameFilter} onValueChange={onGameFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Games</SelectItem>
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
          <select
            className="border rounded-md px-2 py-1"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as 'date' | 'price' | 'title')}
          >
            <option value="date">Date</option>
            <option value="price">Price</option>
            <option value="title">Title</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      <ListingList
        listings={listings}
        onEdit={onEdit}
        onDelete={onDelete}
        onMessage={onMessage}
        onView={onView}
        onShare={onShare}
      />
    </div>
  );
};