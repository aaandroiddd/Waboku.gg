import { Button } from "@/components/ui/button";
import { Listing } from "@/types/database";
import { ListingList } from "./ListingList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingsSearchBar } from "./ListingsSearchBar";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useListingVisibility } from "@/hooks/useListingVisibility";

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
  searchQuery,
  onSearchChange,
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
  const [expiredListings, setExpiredListings] = useState<string[]>([]);
  const [isProcessingExpired, setIsProcessingExpired] = useState(false);
  const { toast } = useToast();
  
  // Use the listing visibility hook to properly filter active listings
  const { visibleListings } = useListingVisibility(listings);

  // Check for expired listings
  useEffect(() => {
    const checkExpiredListings = () => {
      const now = new Date();
      const expired = listings.filter(listing => {
        if (listing.status !== 'active') return false;
        
        const createdAt = listing.createdAt instanceof Date 
          ? listing.createdAt 
          : new Date(listing.createdAt.seconds * 1000);
        
        // Get account tier duration (default to free tier - 48 hours)
        const tierDuration = (listing.accountTier === 'premium' ? 720 : 48) * 60 * 60 * 1000;
        const expirationTime = new Date(createdAt.getTime() + tierDuration);
        
        return now > expirationTime;
      }).map(listing => listing.id);
      
      setExpiredListings(expired);
    };
    
    checkExpiredListings();
    // Check every minute
    const interval = setInterval(checkExpiredListings, 60000);
    return () => clearInterval(interval);
  }, [listings]);

  // Process expired listings
  const processExpiredListings = async () => {
    if (isProcessingExpired || expiredListings.length === 0) return;
    
    setIsProcessingExpired(true);
    let processed = 0;
    let errors = 0;
    
    try {
      toast({
        title: "Processing expired listings",
        description: `Processing ${expiredListings.length} expired listings...`,
        duration: 3000,
      });
      
      // Try to use the archive-expired endpoint first
      try {
        console.log('Calling archive-expired endpoint');
        const archiveResponse = await fetch('/api/listings/archive-expired', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
          }
        });
        
        if (archiveResponse.ok) {
          const result = await archiveResponse.json();
          console.log('Archive response:', result);
          processed = result.summary?.totalArchived || 0;
          
          // If successful, no need to process individual listings
          if (processed > 0) {
            toast({
              title: "Listings Processed",
              description: `Successfully processed ${processed} expired listings.`,
              duration: 5000,
            });
            
            // Refresh the page to update the UI
            window.location.reload();
            return;
          }
        } else {
          console.error('Archive endpoint failed, falling back to individual processing');
          const errorText = await archiveResponse.text();
          console.error('Archive error:', errorText);
        }
      } catch (archiveError) {
        console.error('Error calling archive endpoint:', archiveError);
      }
      
      // Fallback: Process each expired listing individually
      for (const listingId of expiredListings) {
        if (!listingId) {
          console.error("Attempted to process a listing with no ID");
          errors++;
          continue;
        }
        
        try {
          console.log(`Processing expired listing: ${listingId}`);
          const response = await fetch('/api/listings/fix-expired', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ listingId }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`Processed listing ${listingId}:`, result);
            
            if (result.status === 'archived') {
              processed++;
              console.log(`Successfully archived listing: ${listingId}`);
            } else {
              console.log(`Listing ${listingId} status: ${result.status}`);
            }
          } else {
            errors++;
            const errorText = await response.text();
            console.error(`Failed to process listing ${listingId}:`, errorText);
          }
        } catch (error) {
          errors++;
          console.error(`Error processing listing ${listingId}:`, error);
        }
        
        // Add a small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (processed > 0) {
        toast({
          title: "Listings Processed",
          description: `Successfully processed ${processed} expired listings.`,
          duration: 5000,
        });
        
        // Refresh the page to update the UI
        window.location.reload();
      } else if (processed === 0 && errors === 0) {
        toast({
          title: "No Action Needed",
          description: "No listings needed to be archived.",
          duration: 5000,
        });
      }
      
      if (errors > 0) {
        toast({
          title: "Processing Errors",
          description: `Failed to process ${errors} listings. Please try again later.`,
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error processing expired listings:', error);
      toast({
        title: "Error",
        description: "Failed to process expired listings. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessingExpired(false);
    }
  };

  // Process expired listings automatically when detected
  useEffect(() => {
    if (expiredListings.length > 0 && !isProcessingExpired) {
      processExpiredListings();
    }
  }, [expiredListings]);
  return (
    <div className="space-y-4">
      {/* Show alert for expired listings */}
      {expiredListings.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isProcessingExpired 
              ? `Processing ${expiredListings.length} expired listings...` 
              : `${expiredListings.length} expired listings detected. These will be automatically archived.`}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-col space-y-4">
        {/* Search bar */}
        <div className="w-full">
          <ListingsSearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search your listings..."
          />
        </div>

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left side controls */}
          <div className="flex items-center gap-2 order-2 sm:order-1">
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

          {/* Right side view controls */}
          <div className="flex items-center gap-2 ml-auto order-1 sm:order-2">
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
        </div>
      </div>

      <ListingList
        listings={visibleListings}
        onEdit={onEdit}
        onDelete={onDelete}
        onMessage={onMessage}
        onView={onView}
        onShare={onShare}
      />
    </div>
  );
};