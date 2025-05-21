import { formatPrice } from './price';
import { Listing } from '@/types/database';

/**
 * Returns the appropriate display text for a listing's price
 * Consistently handles "Offers Only" listings across the application
 */
export function getDisplayPrice(listing: Listing | null | undefined): string {
  if (!listing) return '';
  
  // Check if this is an "Offers Only" listing
  if (listing.offersOnly === true) {
    return "Offers Only";
  }
  
  // Otherwise format the price normally
  return formatPrice(listing.price);
}