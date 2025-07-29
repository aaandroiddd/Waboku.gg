import { Timestamp } from 'firebase/firestore';

/**
 * TTL-based offer lifecycle management
 * Uses Firestore TTL for automatic deletion with minimal cron job for cleanup
 */

export interface OfferTTLConfig {
  // TTL field name for Firestore automatic deletion
  ttlField: string;
  // Grace period before TTL kicks in (in milliseconds)
  gracePeriod: number;
  // Expired offer duration before automatic deletion (24 hours)
  expiredDuration: number;
}

export const OFFER_TTL_CONFIG: OfferTTLConfig = {
  ttlField: 'deleteAt', // Firestore TTL field
  gracePeriod: 2 * 60 * 60 * 1000, // 2 hours grace period
  expiredDuration: 24 * 60 * 60 * 1000, // 24 hours in expired state
};

/**
 * Calculate TTL timestamp for an offer when it expires
 * @param expiredAt - When the offer was marked as expired
 * @returns Firestore Timestamp for TTL deletion
 */
export function calculateOfferTTL(expiredAt: Date = new Date()): Timestamp {
  const deleteAt = new Date(expiredAt.getTime() + OFFER_TTL_CONFIG.expiredDuration);
  return Timestamp.fromDate(deleteAt);
}

/**
 * Calculate TTL timestamp with grace period for immediate expiration
 * @param now - Current time
 * @returns Firestore Timestamp for TTL deletion with grace period
 */
export function calculateImmediateOfferTTL(now: Date = new Date()): Timestamp {
  const deleteAt = new Date(now.getTime() + OFFER_TTL_CONFIG.gracePeriod);
  return Timestamp.fromDate(deleteAt);
}

/**
 * Update offer with TTL for automatic deletion
 * @param offerData - Offer data to update
 * @param expiredAt - When the offer was expired
 * @returns Updated offer data with TTL
 */
export function addTTLToOffer(offerData: any, expiredAt: Date = new Date()) {
  return {
    ...offerData,
    status: 'expired',
    expiredAt: Timestamp.fromDate(expiredAt),
    [OFFER_TTL_CONFIG.ttlField]: calculateOfferTTL(expiredAt),
    // Keep track of when TTL was set for debugging
    ttlSetAt: Timestamp.now(),
    ttlReason: 'automated_expiration'
  };
}

/**
 * Check if an offer should be immediately deleted (for legacy cleanup)
 * @param offer - Offer document data
 * @returns Whether the offer should be immediately deleted
 */
export function shouldImmediatelyDeleteOffer(offer: any): boolean {
  if (!offer.expiredAt && offer.status !== 'expired') return false;
  
  const expiredDate = offer.expiredAt?.toDate ? offer.expiredAt.toDate() : 
                     offer.status === 'expired' ? new Date(offer.updatedAt?.toDate?.() || offer.createdAt?.toDate?.() || Date.now()) :
                     new Date();
  const now = new Date();
  const expiredAge = now.getTime() - expiredDate.getTime();
  
  return expiredAge > OFFER_TTL_CONFIG.expiredDuration;
}

/**
 * Get TTL status for an offer
 * @param offer - Offer document data
 * @returns TTL status information
 */
export function getOfferTTLStatus(offer: any) {
  const hasDeleteAt = !!offer[OFFER_TTL_CONFIG.ttlField];
  const deleteAt = hasDeleteAt ? 
    (offer[OFFER_TTL_CONFIG.ttlField].toDate ? 
      offer[OFFER_TTL_CONFIG.ttlField].toDate() : 
      new Date(offer[OFFER_TTL_CONFIG.ttlField])) : null;
  
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