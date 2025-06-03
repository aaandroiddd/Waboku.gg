import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Listing } from "@/types/database";
import { Edit2, ExternalLink, MessageCircle, Share2, Trash2, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/price";
import { ContentLoader } from "./ContentLoader";
import { Skeleton } from "./ui/skeleton";
import { useEffect } from "react";
import { ViewCounter } from "./ViewCounter";
import { getListingUrl } from "@/lib/listing-slug";

interface ListingListProps {
  listings: Listing[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMessage: (id: string) => void;
  onView: (id: string) => void;
  onShare: (id: string) => void;
  isLoading?: boolean;
}

const ListingsSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Card key={i} className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-24 sm:h-20 sm:w-20 flex-shrink-0 rounded-md" />
          <div className="flex flex-col sm:flex-row flex-grow gap-3 sm:gap-4 items-start sm:items-center w-full">
            <div className="flex-grow space-y-1 w-full">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-6 w-1/4 mt-2" />
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        </div>
      </Card>
    ))}
  </div>
);

export const ListingList = ({
  listings,
  onEdit,
  onDelete,
  onMessage,
  onView,
  onShare,
  isLoading = false
}: ListingListProps) => {
  // Log for debugging
  useEffect(() => {
    console.log('ListingList received listings:', listings.length);
  }, [listings.length]);
  return (
    <ContentLoader 
      isLoading={isLoading} 
      loadingMessage="Loading your listings..."
      fallback={<ListingsSkeleton />}
    >
      <div className="space-y-4">
        {listings.length === 0 ? (
          <Card className="p-6 text-center">
            <h3 className="text-lg font-medium mb-2">No active listings</h3>
            <p className="text-muted-foreground mb-4">
              Active listings are cards or items you're currently selling. They'll appear here for other users to find and purchase.
            </p>
            <p className="text-sm text-muted-foreground">
              To create a new listing, click the "Create Listing" button in the sidebar.
            </p>
          </Card>
        ) : (
          listings.map((listing) => (
            <Card 
              key={listing.id} 
              className="p-3 sm:p-4 transition-colors duration-200 hover:bg-accent/50"
            >
              <Link href={getListingUrl(listing)}>
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Image Section */}
                  <div className="relative h-24 sm:h-20 sm:w-20 flex-shrink-0">
                    {listing.imageUrls && listing.imageUrls.length > 0 ? (
                      <Image
                        src={listing.imageUrls[typeof listing.coverImageIndex === 'number' ? 
                          Math.min(listing.coverImageIndex, listing.imageUrls.length - 1) : 0]}
                        alt={listing.title}
                        fill
                        className="object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
                        <span className="text-gray-400">No image</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="flex flex-col sm:flex-row flex-grow gap-3 sm:gap-4 items-start sm:items-center">
                    <div className="flex-grow space-y-1">
                      <h3 className="font-semibold text-base sm:text-lg line-clamp-1">{listing.title}</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-base sm:text-lg font-bold">{formatPrice(listing.price)}</p>
                        <ViewCounter viewCount={listing.viewCount || 0} />
                      </div>
                    </div>
                    
                    {/* Actions Section */}
                    <div 
                      className="flex flex-wrap gap-2 w-full sm:w-auto" 
                      onClick={(e) => e.preventDefault()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={(e) => {
                          e.preventDefault();
                          onEdit(listing.id);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial text-red-500 hover:text-red-600"
                        onClick={(e) => {
                          e.preventDefault();
                          onDelete(listing.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Delete</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={(e) => {
                          e.preventDefault();
                          onMessage(listing.id);
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Message</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={(e) => {
                          e.preventDefault();
                          onView(listing.id);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">View</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={(e) => {
                          e.preventDefault();
                          onShare(listing.id);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                        <span className="ml-2 sm:hidden">Share</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            </Card>
          ))
        )}
      </div>
    </ContentLoader>
  );
};