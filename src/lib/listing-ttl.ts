// Import Timestamp from admin SDK for server-side usage
import { Timestamp } from 'firebase-admin/firestore';

/**
 * TTL-based listing lifecycle management
 * Uses Firestore TTL for automatic deletion with minimal cron job for cleanup
 */

export interface TTLConfig {
  // TTL field name for Firestore automatic deletion
  ttlField: string;
  // Grace period before TTL kicks in (in milliseconds)
  gracePeriod: number;
  // Archive duration before automatic deletion (7 days)
  archiveDuration: number;
}

export const LISTING_TTL_CONFIG: TTLConfig = {
  ttlField: 'deleteAt', // Firestore TTL field
  gracePeriod: 24 * 60 * 60 * 1000, // 24 hours grace period
  archiveDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in archive
};

/**
 * Calculate TTL timestamp for a listing when it gets archived
 * @param archivedAt - When the listing was archived
 * @returns Firestore Timestamp for TTL deletion
 */
export function calculateListingTTL(archivedAt: Date = new Date()): Timestamp {
  const deleteAt = new Date(archivedAt.getTime() + LISTING_TTL_CONFIG.archiveDuration);
  return Timestamp.fromDate(deleteAt);
}

/**
 * Calculate TTL timestamp with grace period for immediate archival
 * @param now - Current time
 * @returns Firestore Timestamp for TTL deletion with grace period
 */
export function calculateImmediateTTL(now: Date = new Date()): Timestamp {
  const deleteAt = new Date(now.getTime() + LISTING_TTL_CONFIG.gracePeriod);
  return Timestamp.fromDate(deleteAt);
}

/**
 * Update listing with TTL for automatic deletion
 * @param listingData - Listing data to update
 * @param archivedAt - When the listing was archived
 * @returns Updated listing data with TTL
 */
export function addTTLToListing(listingData: any, archivedAt: Date = new Date()) {
  return {
    ...listingData,
    status: 'archived',
    archivedAt: Timestamp.fromDate(archivedAt),
    [LISTING_TTL_CONFIG.ttlField]: calculateListingTTL(archivedAt),
    // Keep track of when TTL was set for debugging
    ttlSetAt: Timestamp.now(),
    ttlReason: 'automated_archive'
  };
}

/**
 * Check if a listing should be immediately deleted (for legacy cleanup)
 * @param listing - Listing document data
 * @returns Whether the listing should be immediately deleted
 */
export function shouldImmediatelyDelete(listing: any): boolean {
  if (!listing.archivedAt) return false;
  
  const archivedDate = listing.archivedAt.toDate ? listing.archivedAt.toDate() : new Date(listing.archivedAt);
  const now = new Date();
  const archiveAge = now.getTime() - archivedDate.getTime();
  
  return archiveAge > LISTING_TTL_CONFIG.archiveDuration;
}

/**
 * Get TTL status for a listing
 * @param listing - Listing document data
 * @returns TTL status information
 */
export function getTTLStatus(listing: any) {
  const hasDeleteAt = !!listing[LISTING_TTL_CONFIG.ttlField];
  const deleteAt = hasDeleteAt ? 
    (listing[LISTING_TTL_CONFIG.ttlField].toDate ? 
      listing[LISTING_TTL_CONFIG.ttlField].toDate() : 
      new Date(listing[LISTING_TTL_CONFIG.ttlField])) : null;
  
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