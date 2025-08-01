// Client-side TTL utilities that don't depend on Firebase Admin SDK
// Import Timestamp from client-side Firebase SDK
import { Timestamp } from 'firebase/firestore';

/**
 * Client-side TTL configuration
 * Mirrors the server-side configuration but uses client-side Firebase SDK
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
 * Calculate TTL timestamp for a listing when it gets archived (client-side)
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
 * Get TTL status for a listing (client-side version)
 * @param listing - Listing document data
 * @returns TTL status information
 */
export function getClientTTLStatus(listing: any) {
  const hasDeleteAt = !!listing[CLIENT_LISTING_TTL_CONFIG.ttlField];
  const deleteAt = hasDeleteAt ? 
    (listing[CLIENT_LISTING_TTL_CONFIG.ttlField].toDate ? 
      listing[CLIENT_LISTING_TTL_CONFIG.ttlField].toDate() : 
      new Date(listing[CLIENT_LISTING_TTL_CONFIG.ttlField])) : null;
  
  const now = new Date();
  const isExpired = deleteAt ? now > deleteAt : false;
  const timeUntilDeletion = deleteAt ? deleteAt.getTime() - now.getTime() : null;
  
  return {
    hasTTL: hasDeleteAt,
    deleteAt,
    isExpired,
    timeUntilDeletion,
    hoursUntilDeletion: timeUntilDeletion ? Math.round(timeUntilDeletion / (1000 * 60 * 60)) : null
  };
}