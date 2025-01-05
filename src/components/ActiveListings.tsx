import { Button } from "@/components/ui/button";
import { Listing } from "@/types/database";
import { ListingList } from "./ListingList";

interface ActiveListingsProps {
  listings: Listing[];
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'price' | 'title';
  sortOrder: 'asc' | 'desc';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onSortByChange: (sortBy: 'date' | 'price' | 'title') => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
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
  onViewModeChange,
  onSortByChange,
  onSortOrderChange,
  onEdit,
  onDelete,
  onMessage,
  onView,
  onShare,
}: ActiveListingsProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
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
        <div className="flex items-center gap-4">
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