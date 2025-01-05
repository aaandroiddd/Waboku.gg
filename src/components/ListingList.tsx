import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Listing } from "@/types/database";
import { Edit2, ExternalLink, MessageCircle, Share2, Trash2 } from "lucide-react";
import Image from "next/image";

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
        <Card key={listing.id} className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 flex-shrink-0">
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
            
            <div className="flex-grow">
              <h3 className="font-semibold text-lg">{listing.title}</h3>
              <p className="text-lg font-bold">${listing.price.toFixed(2)}</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(listing.id)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={() => onDelete(listing.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMessage(listing.id)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(listing.id)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShare(listing.id)}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};