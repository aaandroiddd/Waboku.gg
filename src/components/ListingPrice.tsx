import React from 'react';
import { formatPrice } from '@/lib/price';

interface ListingPriceProps {
  price: number;
  offersOnly?: boolean;
  className?: string;
}

export const ListingPrice: React.FC<ListingPriceProps> = ({ 
  price, 
  offersOnly = false,
  className = "text-3xl md:text-4xl font-bold"
}) => {
  return (
    <div className={className}>
      {offersOnly ? "Offers Only" : formatPrice(price)}
    </div>
  );
};