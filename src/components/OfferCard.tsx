import { Offer } from '@/types/offer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/price';
import { format } from 'date-fns';
import Image from 'next/image';
import { UserNameLink } from '@/components/UserNameLink';
import { Check, X } from 'lucide-react';
import { useOffers } from '@/hooks/useOffers';
import { useState } from 'react';

interface OfferCardProps {
  offer: Offer;
  type: 'received' | 'sent';
}

export function OfferCard({ offer, type }: OfferCardProps) {
  const { updateOfferStatus } = useOffers();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAccept = async () => {
    setIsUpdating(true);
    await updateOfferStatus(offer.id, 'accepted');
    setIsUpdating(false);
  };

  const handleDecline = async () => {
    setIsUpdating(true);
    await updateOfferStatus(offer.id, 'declined');
    setIsUpdating(false);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'accepted':
        return 'default';
      case 'declined':
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
            {offer.listingSnapshot.imageUrl ? (
              <Image
                src={offer.listingSnapshot.imageUrl}
                alt={offer.listingSnapshot.title}
                fill
                className="object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No image</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{offer.listingSnapshot.title}</h3>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {type === 'received' ? 'From: ' : 'To: '}
                <UserNameLink userId={type === 'received' ? offer.buyerId : offer.sellerId} />
              </p>
              <p className="text-muted-foreground">
                Date: {format(offer.createdAt, 'PPP')}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div>
                  <span className="text-muted-foreground">Listing Price: </span>
                  <span>{formatPrice(offer.listingSnapshot.price)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Offer: </span>
                  <span className="font-semibold">{formatPrice(offer.amount)}</span>
                </div>
              </div>
              <Badge
                variant={getStatusBadgeVariant(offer.status)}
              >
                {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
              </Badge>
            </div>
          </div>
          
          {type === 'received' && offer.status === 'pending' && (
            <div className="flex flex-row md:flex-col gap-2 mt-2 md:mt-0">
              <Button 
                variant="default" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={isUpdating}
              >
                <Check className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                onClick={handleDecline}
                disabled={isUpdating}
              >
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}