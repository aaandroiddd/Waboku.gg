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
  AlertTriangle,
  Loader2
} from "lucide-react";
import { ListingTimer } from "@/components/ListingTimer";
import { ViewCounter } from "@/components/ViewCounter";
import { parseDate, formatDate } from "@/lib/date-utils";

interface MultiSelectListingsProps {
  listings: Listing[];
  type: 'active' | 'archived';
  accountTier: string;
  viewMode?: 'grid' | 'list';
  archivedCount?: number; // Number of archived listings (for active tab empty state)
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
  viewMode = 'grid',
  archivedCount = 0,
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
  const [loadingAction, setLoadingAction] = useState<'archive' | 'delete' | 'restore' | null>(null);
  const { toast } = useToast();

  const formatPrice = (price: any): string => {
    if (typeof price === 'number') {
      return price.toFixed(2);
    }
    const numPrice = parseFloat(price || '0');
    return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2);
  };

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

    // Set loading state
    setLoadingAction(action);

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
    } finally {
      // Clear loading state
      setLoadingAction(null);
    }
  };

  // Clear selection when switching between tabs
  useEffect(() => {
    setSelectedListings([]);
    setIsSelectMode(false);
    setLoadingAction(null);
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
        
        {/* Show archived listings info when on active tab and there are archived listings */}
        {type === 'active' && archivedCount > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
              <strong>You have {archivedCount} archived listing{archivedCount !== 1 ? 's' : ''}.</strong>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Check your "Archived" tab to restore listings before they are automatically deleted after 7 days.
            </p>
          </div>
        )}
        
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
      <div className="bg-muted/50 p-3 rounded-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isSelectMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                if (!isSelectMode) {
                  setSelectedListings([]);
                }
              }}
              className="flex-shrink-0"
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
                  className="flex-shrink-0"
                >
                  {selectedListings.length === listings.length ? 'Deselect All' : 'Select All'}
                </Button>
                
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {selectedListings.length} of {listings.length} selected
                </span>
              </>
            )}
          </div>

          {/* Bulk action buttons */}
          {isSelectMode && selectedListings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {type === 'active' && onBulkArchive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('archive')}
                  disabled={loadingAction !== null}
                  className="text-orange-600 hover:text-orange-700 flex-shrink-0 disabled:opacity-50"
                >
                  {loadingAction === 'archive' ? (
                    <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4 mr-1 sm:mr-2" />
                  )}
                  <span className="hidden xs:inline">
                    {loadingAction === 'archive' ? 'Archiving...' : 'Archive '}
                  </span>
                  {loadingAction !== 'archive' && `(${selectedListings.length})`}
                </Button>
              )}
              
              {type === 'archived' && onBulkRestore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('restore')}
                  disabled={loadingAction !== null}
                  className="text-green-600 hover:text-green-700 flex-shrink-0 disabled:opacity-50"
                >
                  {loadingAction === 'restore' ? (
                    <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-1 sm:mr-2" />
                  )}
                  <span className="hidden xs:inline">
                    {loadingAction === 'restore' ? 'Restoring...' : 'Restore '}
                  </span>
                  {loadingAction !== 'restore' && `(${selectedListings.length})`}
                </Button>
              )}
              
              {onBulkDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  disabled={loadingAction !== null}
                  className="text-red-600 hover:text-red-700 flex-shrink-0 disabled:opacity-50"
                >
                  {loadingAction === 'delete' ? (
                    <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                  )}
                  <span className="hidden xs:inline">
                    {loadingAction === 'delete' ? 'Deleting...' : 'Delete '}
                  </span>
                  {loadingAction !== 'delete' && `(${selectedListings.length})`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warning for bulk delete */}
      {isSelectMode && selectedListings.length > 0 && !loadingAction && (
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

      {/* Loading message during bulk operations */}
      {loadingAction && (
        <Alert className="bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-800">
          <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
          <AlertDescription>
            {loadingAction === 'archive' && `Archiving ${selectedListings.length} listing(s)... This may take a moment.`}
            {loadingAction === 'delete' && `Deleting ${selectedListings.length} listing(s)... This may take a moment.`}
            {loadingAction === 'restore' && `Restoring ${selectedListings.length} listing(s)... This may take a moment.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Listings display - Grid or List view */}
      {viewMode === 'list' ? (
        /* List View */
        <div className="space-y-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="relative group hover:shadow-md transition-shadow">
              {/* Selection checkbox */}
              {isSelectMode && (
                <div className="absolute top-4 left-4 z-10">
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

              <CardContent className={`p-4 ${isSelectMode ? 'pl-12' : ''}`}>
                <div className="flex gap-4">
                  {/* Image Section */}
                  <div className="relative h-24 sm:h-32 w-24 sm:w-32 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
                    {listing.imageUrls?.[0] ? (
                      <img
                        src={listing.imageUrls[0]}
                        alt={listing.title}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/rect.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">No image</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left side - Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base truncate">{listing.title}</h3>
                        <Badge className={getConditionColor(listing.condition)}>
                          {listing.condition}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                        <span>{listing.game}</span>
                        <span>•</span>
                        <span>Listed on {formatDate(listing.createdAt, true)}</span>
                        {type === 'archived' && listing.archivedAt && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-medium">
                              Archived on {formatDate(listing.archivedAt, true)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Timer */}
                      <div className="mb-2">
                        <ListingTimer
                          createdAt={listing.createdAt}
                          archivedAt={type === 'archived' ? listing.archivedAt || listing.createdAt : undefined}
                          accountTier={accountTier as 'free' | 'premium'}
                          status={type === 'archived' ? 'archived' : listing.status}
                          listingId={listing.id}
                        />
                      </div>
                    </div>

                    {/* Right side - Price and actions */}
                    <div className="flex flex-col sm:items-end gap-3">
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className="font-bold text-lg">${formatPrice(listing.price)}</span>
                      
                      {/* View counter for premium users */}
                      {accountTier === 'premium' && type === 'active' && (
                        <ViewCounter viewCount={listing.viewCount || 0} />
                      )}
                      
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

                    {/* Action buttons */}
                    {!isSelectMode && (
                      <div className="flex flex-wrap gap-2 relative z-10">
                        {type === 'active' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={loadingAction !== null}
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
                              disabled={loadingAction !== null}
                              className="text-orange-600 hover:text-orange-700 disabled:opacity-50"
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
                              disabled={loadingAction !== null}
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
                              disabled={loadingAction !== null}
                              className="text-green-600 hover:text-green-700 disabled:opacity-50"
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
                              disabled={loadingAction !== null}
                              className="text-red-600 hover:text-red-700 disabled:opacity-50"
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Grid View */
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
                <div className="space-y-3">

                  
                  <div className="flex justify-between items-center">
                    <Badge className={getConditionColor(listing.condition)}>
                      {listing.condition}
                    </Badge>
                    <span className="font-bold">${formatPrice(listing.price)}</span>
                  </div>

                  {/* View counter for premium users */}
                  {accountTier === 'premium' && type === 'active' && (
                    <div className="flex justify-end">
                      <ViewCounter viewCount={listing.viewCount || 0} />
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    Listed on {formatDate(listing.createdAt, true)}
                  </div>

                  {/* Timer */}
                  <div className="mt-2">
                    <ListingTimer
                      createdAt={listing.createdAt}
                      archivedAt={type === 'archived' ? listing.archivedAt || listing.createdAt : undefined}
                      accountTier={accountTier as 'free' | 'premium'}
                      status={type === 'archived' ? 'archived' : listing.status}
                      listingId={listing.id}
                    />
                  </div>

                  {/* Archived status */}
                  {type === 'archived' && listing.archivedAt && (
                    <div className="text-sm text-amber-600 font-medium">
                      Archived on {formatDate(listing.archivedAt, true)}
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
                            disabled={loadingAction !== null}
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
                            disabled={loadingAction !== null}
                            className="text-orange-600 hover:text-orange-700 disabled:opacity-50"
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
                            disabled={loadingAction !== null}
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
                            disabled={loadingAction !== null}
                            className="text-green-600 hover:text-green-700 disabled:opacity-50"
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
                            disabled={loadingAction !== null}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
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
      )}
    </div>
  );
}