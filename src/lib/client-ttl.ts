/**
 * Client-side TTL filtering utilities
 * Filters out listings that should be hidden from the UI based on their deleteAt timestamp
 */

import { Listing } from '@/types/database';

/**
 * Checks if a listing should be hidden from the UI based on its deleteAt timestamp
 * @param listing - The listing to check
 * @returns true if the listing should be hidden, false otherwise
 */
export function shouldHideListingFromUI(listing: Listing): boolean {
  // Only apply this logic to archived listings
  if (listing.status !== 'archived') {
    return false;
  }

  // Check if the listing has a deleteAt field
  if (!listing.deleteAt) {
    return false;
  }

  try {
    let deleteAtTime: number;

    // Handle different timestamp formats
    if (listing.deleteAt instanceof Date) {
      deleteAtTime = listing.deleteAt.getTime();
    } else if (typeof listing.deleteAt === 'object' && listing.deleteAt !== null) {
      // Handle Firestore Timestamp with toDate method
      if ('toDate' in listing.deleteAt && typeof listing.deleteAt.toDate === 'function') {
        deleteAtTime = listing.deleteAt.toDate().getTime();
      }
      // Handle Firestore Timestamp with seconds and nanoseconds
      else if ('seconds' in listing.deleteAt) {
        deleteAtTime = (listing.deleteAt as any).seconds * 1000;
      } else if ('_seconds' in listing.deleteAt) {
        deleteAtTime = (listing.deleteAt as any)._seconds * 1000;
      } else {
        console.warn('Unknown deleteAt timestamp format:', listing.deleteAt);
        return false;
      }
    } else if (typeof listing.deleteAt === 'string') {
      deleteAtTime = Date.parse(listing.deleteAt);
    } else if (typeof listing.deleteAt === 'number') {
      deleteAtTime = listing.deleteAt;
    } else {
      console.warn('Invalid deleteAt type:', typeof listing.deleteAt);
      return false;
    }

    if (isNaN(deleteAtTime)) {
      console.warn('Invalid deleteAt timestamp:', listing.deleteAt);
      return false;
    }

    // Check if the current time is past the deleteAt time
    const now = Date.now();
    return now >= deleteAtTime;
  } catch (error) {
    console.error('Error checking deleteAt timestamp:', error);
    return false;
  }
}

/**
 * Filters out listings that should be hidden from the UI based on their deleteAt timestamp
 * @param listings - Array of listings to filter
 * @returns Filtered array with hidden listings removed
 */
export function filterVisibleListings(listings: Listing[]): Listing[] {
  return listings.filter(listing => !shouldHideListingFromUI(listing));
}

/**
 * Separates listings into visible and hidden based on their deleteAt timestamp
 * @param listings - Array of listings to separate
 * @returns Object with visible and hidden listing arrays
 */
export function separateVisibleListings(listings: Listing[]): {
  visible: Listing[];
  hidden: Listing[];
} {
  const visible: Listing[] = [];
  const hidden: Listing[] = [];

  listings.forEach(listing => {
    if (shouldHideListingFromUI(listing)) {
      hidden.push(listing);
    } else {
      visible.push(listing);
    }
  });

  return { visible, hidden };
}

/**
 * Gets the count of listings that should be hidden from the UI
 * @param listings - Array of listings to count
 * @returns Number of listings that should be hidden
 */
export function getHiddenListingsCount(listings: Listing[]): number {
  return listings.filter(listing => shouldHideListingFromUI(listing)).length;
}