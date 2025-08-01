import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * TTL Field Manager - Centralized utility for proper TTL field management
 * 
 * This utility ensures that TTL fields are properly managed using Firebase's
 * FieldValue.delete() instead of setting them to null, which is the correct
 * way to remove fields from Firestore documents.
 */

export interface TTLFieldOperations {
  // Fields to set with TTL values
  set?: Record<string, Timestamp>;
  // Fields to remove (will use FieldValue.delete())
  remove?: string[];
}

/**
 * Creates a safe update object for TTL fields that properly handles
 * field deletion using FieldValue.delete() instead of null
 * 
 * @param operations - Object specifying which TTL fields to set or remove
 * @returns Update object safe for Firestore operations
 */
export function createTTLUpdateObject(operations: TTLFieldOperations): Record<string, any> {
  const updateObject: Record<string, any> = {};
  
  // Set TTL fields with proper Timestamp values
  if (operations.set) {
    Object.entries(operations.set).forEach(([field, timestamp]) => {
      updateObject[field] = timestamp;
    });
  }
  
  // Remove TTL fields using FieldValue.delete()
  if (operations.remove) {
    operations.remove.forEach(field => {
      updateObject[field] = FieldValue.delete();
    });
  }
  
  return updateObject;
}

/**
 * Common TTL field names used throughout the application
 */
export const TTL_FIELDS = {
  LISTING_DELETE_AT: 'deleteAt',
  LISTING_TTL_SET_AT: 'ttlSetAt',
  LISTING_TTL_REASON: 'ttlReason',
  OFFER_DELETE_AT: 'deleteAt',
  OFFER_TTL_SET_AT: 'ttlSetAt',
  OFFER_TTL_REASON: 'ttlReason',
  ARCHIVED_AT: 'archivedAt',
  EXPIRATION_REASON: 'expirationReason'
} as const;

/**
 * Creates update object for archiving a listing with proper TTL
 * 
 * @param ttlTimestamp - When the listing should be automatically deleted
 * @param reason - Reason for archival
 * @returns Update object for archiving with TTL
 */
export function createListingArchiveUpdate(
  ttlTimestamp: Timestamp, 
  reason: string = 'automated_archive'
): Record<string, any> {
  return {
    status: 'archived',
    archivedAt: Timestamp.now(),
    [TTL_FIELDS.LISTING_DELETE_AT]: ttlTimestamp,
    [TTL_FIELDS.LISTING_TTL_SET_AT]: Timestamp.now(),
    [TTL_FIELDS.LISTING_TTL_REASON]: reason,
    updatedAt: Timestamp.now()
  };
}

/**
 * Creates update object for restoring an archived listing
 * Properly removes all archive-related and TTL fields
 * 
 * @param newStatus - Status to restore to (default: 'active')
 * @param expiresAt - New expiration timestamp
 * @returns Update object for restoration
 */
export function createListingRestoreUpdate(
  newStatus: string = 'active',
  expiresAt?: Timestamp
): Record<string, any> {
  const updateObject = createTTLUpdateObject({
    remove: [
      TTL_FIELDS.LISTING_DELETE_AT,
      TTL_FIELDS.LISTING_TTL_SET_AT,
      TTL_FIELDS.LISTING_TTL_REASON,
      TTL_FIELDS.ARCHIVED_AT,
      TTL_FIELDS.EXPIRATION_REASON
    ]
  });
  
  return {
    ...updateObject,
    status: newStatus,
    updatedAt: Timestamp.now(),
    restoredAt: Timestamp.now(),
    restoredReason: 'manual_restoration',
    ...(expiresAt && { expiresAt })
  };
}

/**
 * Creates update object for expiring an offer with proper TTL
 * 
 * @param ttlTimestamp - When the offer should be automatically deleted
 * @param reason - Reason for expiration
 * @returns Update object for expiring with TTL
 */
export function createOfferExpireUpdate(
  ttlTimestamp: Timestamp,
  reason: string = 'automated_expiration'
): Record<string, any> {
  return {
    status: 'expired',
    expiredAt: Timestamp.now(),
    [TTL_FIELDS.OFFER_DELETE_AT]: ttlTimestamp,
    [TTL_FIELDS.OFFER_TTL_SET_AT]: Timestamp.now(),
    [TTL_FIELDS.OFFER_TTL_REASON]: reason,
    updatedAt: Timestamp.now()
  };
}

/**
 * Creates update object for restoring an expired offer
 * Properly removes all expiration-related and TTL fields
 * 
 * @param newStatus - Status to restore to (default: 'pending')
 * @param expiresAt - New expiration timestamp
 * @returns Update object for restoration
 */
export function createOfferRestoreUpdate(
  newStatus: string = 'pending',
  expiresAt?: Timestamp
): Record<string, any> {
  const updateObject = createTTLUpdateObject({
    remove: [
      TTL_FIELDS.OFFER_DELETE_AT,
      TTL_FIELDS.OFFER_TTL_SET_AT,
      TTL_FIELDS.OFFER_TTL_REASON,
      'expiredAt'
    ]
  });
  
  return {
    ...updateObject,
    status: newStatus,
    updatedAt: Timestamp.now(),
    restoredAt: Timestamp.now(),
    restoredReason: 'manual_restoration',
    ...(expiresAt && { expiresAt })
  };
}

/**
 * Validates that TTL fields are properly managed in an update object
 * Throws an error if any TTL fields are set to null
 * 
 * @param updateObject - Object to validate
 * @throws Error if TTL fields are improperly set to null
 */
export function validateTTLFieldUpdate(updateObject: Record<string, any>): void {
  const ttlFieldValues = Object.values(TTL_FIELDS);
  const commonTTLFields = ['deleteAt', 'ttlSetAt', 'ttlReason', 'archivedAt', 'expirationReason', 'expiredAt'];
  
  const allTTLFields = [...ttlFieldValues, ...commonTTLFields];
  
  for (const [field, value] of Object.entries(updateObject)) {
    if (allTTLFields.includes(field) && value === null) {
      throw new Error(
        `TTL field '${field}' is set to null. Use FieldValue.delete() instead. ` +
        `Consider using createTTLUpdateObject() or the helper functions in ttl-field-manager.ts`
      );
    }
  }
}

/**
 * Safe wrapper for Firestore document updates that validates TTL field management
 * 
 * @param docRef - Firestore document reference
 * @param updateObject - Update object to apply
 * @returns Promise that resolves when update is complete
 */
export async function safeTTLUpdate(
  docRef: FirebaseFirestore.DocumentReference,
  updateObject: Record<string, any>
): Promise<void> {
  validateTTLFieldUpdate(updateObject);
  await docRef.update(updateObject);
}