import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Listing } from "@/types/database";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { 
  Edit2, 
  Trash2, 
  MessageCircle, 
  Share2, 
  ExternalLink, 
  Archive, 
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle
} from "lucide-react";
import { ListingTimer } from "@/components/ListingTimer";
import { ViewCounter } from "@/components/ViewCounter";

interface MultiSelectListingsProps {
  listings: Listing[];
  type: 'active' | 'archived';
  accountTier: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMessage: (id: string) => void;
  onView: (id: string) => void;
  onShare: (id: string) => void;
  onRestore?: (id: string) => void;
  onBulkArchive?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkRestore?: (ids: string[]) => void;
}

export function MultiSelectListings({
  listings,
  type,
  accountTier,
  onEdit,
  onDelete,
  onMessage,
  onView,
  onShare,
  onRestore,
  onBulkArchive,
  onBulkDelete,
  onBulkRestore,
}: MultiSelectListingsProps) {
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const { toast } = useToast();

  const getConditionColor = (condition: string | undefined | null) => {
    if (!condition || typeof condition !== 'string') return 'bg-gray-100 text-gray-800';
    
    const conditionLower = condition.toLowerCase();
    
    switch (conditionLower) {
      case 'mint':
      case 'near-mint':
        return 'bg-green-100 text-green-800';
      case 'excellent':
      case 'light-played':
        return 'bg-yellow-100 text-yellow-800';
      case 'good':
      case 'played':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectListing = (listingId: string) => {
    setSelectedListings(prev => 
      prev.includes(listingId) 
        ? prev.filter(id => id !== listingId)
        : [...prev, listingId]
    );
  };

  const handleSelectAll = () => {
    if (selectedListings.length === listings.length) {
      setSelectedListings([]);
    } else {
      setSelectedListings(listings.map(listing => listing.id));
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete' | 'restore') => {
    if (selectedListings.length === 0) {
      toast({
        title: "No listings selected",
        description: "Please select at least one listing to perform this action.",
        variant: "destructive",
      });
      return;
    }

    try {
      switch (action) {
        case 'archive':
          if (onBulkArchive) {
            await onBulkArchive(selectedListings);
            toast({
              title: "Listings archived",
              description: `Successfully archived ${selectedListings.length} listing(s).`,
            });
          }
          break;
        case 'delete':
          if (onBulkDelete) {
            await onBulkDelete(selectedListings);
            toast({
              title: "Listings deleted",
              description: `Successfully deleted ${selectedListings.length} listing(s).`,
            });
          }
          break;
        case 'restore':
          if (onBulkRestore) {
            await onBulkRestore(selectedListings);
            toast({
              title: "Listings restored",
              description: `Successfully restored ${selectedListings.length} listing(s).`,
            });
          }
          break;
      }
      
      // Clear selection after successful action
      setSelectedListings([]);
      setIsSelectMode(false);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} selected listings. Please try again.`,
        variant: "destructive",
      });
    }
  };

  // Clear selection when switching between tabs
  useEffect(() => {
    setSelectedListings([]);
    setIsSelectMode(false);
  }, [type]);

  if (listings.length === 0) {
    return (
      <Card className="p-6 text-center">
        <h3 className="text-lg font-medium mb-2">
          {type === 'active' ? 'No active listings' : 'No archived listings'}
        </h3>
        <p className="text-muted-foreground mb-4">
          {type === 'active' 
            ? "Active listings are cards or items you're currently selling. They'll appear here for other users to find and purchase."
            : "Archived listings are items you've removed from active sale. They're no longer visible to buyers but can be restored if needed."
          }
        </p>
        {type === 'active' && (
          <p className="text-sm text-muted-foreground">
            To create a new listing, click the "Create Listing" button in the sidebar.
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Multi-select controls */}
      <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
        <div className="flex items-center gap-3">
          <Button
            variant={isSelectMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (!isSelectMode) {
                setSelectedListings([]);
              }
            }}
          >
            {isSelectMode ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
            {isSelectMode ? 'Exit Select' : 'Select Multiple'}
          </Button>
          
          {isSelectMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedListings.length === listings.length ? 'Deselect All' : 'Select All'}
              </Button>
              
              <span className="text-sm text-muted-foreground">
                {selectedListings.length} of {listings.length} selected
              </span>
            </>
          )}
        </div>

        {/* Bulk action buttons */}
        {isSelectMode && selectedListings.length > 0 && (
          <div className="flex items-center gap-2">
            {type === 'active' && onBulkArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('archive')}
                className="text-orange-600 hover:text-orange-700"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive ({selectedListings.length})
              </Button>
            )}
            
            {type === 'archived' && onBulkRestore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('restore')}
                className="text-green-600 hover:text-green-700"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore ({selectedListings.length})
              </Button>
            )}
            
            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedListings.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Warning for bulk delete */}
      {isSelectMode && selectedListings.length > 0 && (
        <Alert variant="warning" className="bg-amber-50 text-amber-800 dark:bg-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription>
            {type === 'active' 
              ? `You have selected ${selectedListings.length} listing(s). Archiving will move them to your archived listings where they can be restored later.`
              : `You have selected ${selectedListings.length} listing(s). Deleting will permanently remove them and cannot be undone.`
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Listings grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <Card key={listing.id} className="relative group hover:shadow-lg transition-shadow">
            {/* Selection checkbox */}
            {isSelectMode && (
              <div className="absolute top-3 left-3 z-10">
                <Checkbox
                  checked={selectedListings.includes(listing.id)}
                  onCheckedChange={() => handleSelectListing(listing.id)}
                  className="bg-white border-2 shadow-sm"
                />
              </div>
            )}

            {/* Clickable area for viewing listing */}
            <div 
              className={`absolute inset-0 ${isSelectMode ? 'pointer-events-none' : ''}`}
              onClick={() => !isSelectMode && onView(listing.id)}
            />

            <CardHeader className={isSelectMode ? 'pl-12' : ''}>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{listing.title}</CardTitle>
                  <CardDescription>{listing.game}</CardDescription>
                </div>
                {!isSelectMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(listing.id);
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className={isSelectMode ? 'pl-12' : ''}>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Badge className={getConditionColor(listing.condition)}>
                    {listing.condition}
                  </Badge>
                  <span className="font-bold">${listing.price.toFixed(2)}</span>
                </div>

                {/* View counter for premium users */}
                {accountTier === 'premium' && type === 'active' && (
                  <div className="flex justify-end">
                    <ViewCounter viewCount={listing.viewCount || 0} />
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Listed on {new Date(listing.createdAt).toLocaleDateString()}
                </div>

                {/* Timer */}
                <div className="mt-2">
                  <ListingTimer
                    createdAt={listing.createdAt}
                    archivedAt={type === 'archived' ? listing.archivedAt || listing.createdAt : undefined}
                    accountTier={accountTier}
                    status={type === 'archived' ? 'archived' : listing.status}
                  />
                </div>

                {/* Archived status */}
                {type === 'archived' && listing.archivedAt && (
                  <div className="text-sm text-amber-600 font-medium">
                    Archived on {new Date(listing.archivedAt).toLocaleDateString()}
                  </div>
                )}

                {/* Action buttons */}
                {!isSelectMode && (
                  <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                    {type === 'active' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(listing.id);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(listing.id);
                          }}
                        >
                          <Archive className="h-4 w-4 mr-1" />
                          Archive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMessage(listing.id);
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Messages
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore && onRestore(listing.id);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(listing.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(listing.id);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}