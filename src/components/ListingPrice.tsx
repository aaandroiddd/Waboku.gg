import React from 'react';
import { formatPrice } from '@/lib/price';

interface ListingPriceProps {
  price: number;
  offersOnly?: boolean;
  shippingCost?: number;
  className?: string;
  showShippingDetails?: boolean;
}

export const ListingPrice: React.FC<ListingPriceProps> = ({ 
  price, 
  offersOnly = false,
  shippingCost,
  className = "text-3xl md:text-4xl font-bold",
  showShippingDetails = false
}) => {
  if (offersOnly) {
    return (
      <div className={className}>
        Offers Only
      </div>
    );
  }

  const hasShipping = shippingCost && shippingCost > 0;

  return (
    <div className="space-y-1">
      <div className={className}>
        {formatPrice(price)}
      </div>
      {showShippingDetails && hasShipping && (
        <div className="text-sm text-muted-foreground">
          + {formatPrice(shippingCost)} shipping
        </div>
      )}
      {showShippingDetails && !hasShipping && (
        <div className="text-sm text-muted-foreground">
          Free shipping
        </div>
      )}
    </div>
  );
};