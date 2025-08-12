/**
 * Client-side TTL filtering utilities
 * Filters out listings that should be hidden from the UI based on their deleteAt timestamp
 */

import { Listing } from '@/types/database';
import { Timestamp } from 'firebase/firestore';

/**
 * Client-side TTL configuration (matches server-side config)
 */
export interface ClientTTLConfig {
  // TTL field name for Firestore automatic deletion
  ttlField: string;
  // Grace period before TTL kicks in (in milliseconds)
  gracePeriod: number;
  // Archive duration before automatic deletion (7 days)
  archiveDuration: number;
}

export const CLIENT_LISTING_TTL_CONFIG: ClientTTLConfig = {
  ttlField: 'deleteAt', // Firestore TTL field
  gracePeriod: 24 * 60 * 60 * 1000, // 24 hours grace period
  archiveDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in archive
};

/**
 * Calculate TTL timestamp for a listing when it gets archived (client-side version)
 * @param archivedAt - When the listing was archived
 * @returns Firestore Timestamp for TTL deletion
 */
export function calculateClientListingTTL(archivedAt: Date = new Date()): Timestamp {
  const deleteAt = new Date(archivedAt.getTime() + CLIENT_LISTING_TTL_CONFIG.archiveDuration);
  return Timestamp.fromDate(deleteAt);
}

/**
 * Update listing with TTL for automatic deletion (client-side version)
 * @param listingData - Listing data to update
 * @param archivedAt - When the listing was archived
 * @returns Updated listing data with TTL
 */
export function addClientTTLToListing(listingData: any, archivedAt: Date = new Date()) {
  return {
    ...listingData,
    status: 'archived',
    archivedAt: Timestamp.fromDate(archivedAt),
    [CLIENT_LISTING_TTL_CONFIG.ttlField]: calculateClientListingTTL(archivedAt),
    // Keep track of when TTL was set for debugging
    ttlSetAt: Timestamp.now(),
    ttlReason: 'automated_archive'
  };
}

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