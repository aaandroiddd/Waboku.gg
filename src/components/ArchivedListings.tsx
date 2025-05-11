import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Listing } from "@/types/database";
import { ExternalLink, Trash2 } from "lucide-react";
import { ListingTimer } from "@/components/ListingTimer";
import { EmptyStateCard } from "@/components/EmptyStateCard";

interface ArchivedListingsProps {
  listings: Listing[];
  accountTier: string;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}

export function ArchivedListings({
  listings,
  accountTier,
  onRestore,
  onDelete,
  onView,
}: ArchivedListingsProps) {
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

  if (listings.length === 0) {
    return (
      <EmptyStateCard
        title="No archived listings"
        description="Archived listings are items you've removed from active sale. They're no longer visible to buyers but can be restored if needed."
        actionText="When you archive an active listing, it will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <Card key={listing.id} className="relative group hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{listing.title}</CardTitle>
                <CardDescription>{listing.game}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Badge className={getConditionColor(listing.condition)}>
                  {listing.condition}
                </Badge>
                <span className="font-bold">${listing.price.toFixed(2)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Listed on {new Date(listing.createdAt).toLocaleDateString()}
              </div>
              {/* Timer for archived listings */}
              <div className="mt-2">
                <ListingTimer
                  createdAt={listing.createdAt}
                  archivedAt={listing.archivedAt || listing.createdAt}
                  accountTier={accountTier}
                  status="archived"
                />
              </div>
              {/* Display archived status with date */}
              {listing.archivedAt && (
                <div className="text-sm text-amber-600 font-medium">
                  Archived on {new Date(listing.archivedAt).toLocaleDateString()}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onRestore(listing.id)}
                >
                  Restore Listing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => onDelete(listing.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Permanently
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(listing.id)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}