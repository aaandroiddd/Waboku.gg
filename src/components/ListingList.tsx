import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Listing } from "@/types/database";
import { Edit2, ExternalLink, MessageCircle, Share2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/price";

interface ListingListProps {
  listings: Listing[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMessage: (id: string) => void;
  onView: (id: string) => void;
  onShare: (id: string) => void;
}

export const ListingList = ({
  listings,
  onEdit,
  onDelete,
  onMessage,
  onView,
  onShare,
}: ListingListProps) => {
  return (
    <div className="space-y-4">
      {listings.map((listing) => (
        <Card 
          key={listing.id} 
          className="p-3 sm:p-4 transition-colors duration-200 hover:bg-accent/50"
        >
          <Link href={`/listings/${listing.id}`}>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Image Section */}
              <div className="relative h-24 sm:h-20 sm:w-20 flex-shrink-0">
                {listing.imageUrls?.[0] ? (
                  <Image
                    src={listing.imageUrls[0]}
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
                  <p className="text-base sm:text-lg font-bold">{formatPrice(listing.price)}</p>
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
      ))}
    </div>
  );
};