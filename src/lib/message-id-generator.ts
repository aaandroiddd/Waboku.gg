/**
 * Message ID Generator
 * Generates readable message IDs in the format: MSG{YYYYMMDD}{7-digit-number}
 * Example: MSG202407230000001, MSG202407230000002, etc.
 */

import { getDatabase, ref, get, set, runTransaction } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';

// Counter path in Firebase Realtime Database
const COUNTER_PATH = 'system/messageIdCounters';

/**
 * Generate a new message ID in the format MSG{YYYYMMDD}{7-digit-number}
 * This function ensures uniqueness and handles scaling by using daily counters
 */
export async function generateMessageId(): Promise<string> {
  try {
    const { database } = getFirebaseServices();
    if (!database) {
      throw new Error('Database connection not available');
    }

    // Get current date in YYYYMMDD format
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');

    // Counter reference for today's date
    const counterRef = ref(database, `${COUNTER_PATH}/${dateStr}`);

    // Use a transaction to atomically increment the counter
    const result = await runTransaction(counterRef, (currentValue) => {
      // If no counter exists for today, start at 1
      // Otherwise, increment the existing counter
      return (currentValue || 0) + 1;
    });

    if (!result.committed) {
      throw new Error('Failed to generate unique message ID - transaction not committed');
    }

    const counter = result.snapshot.val();
    
    // Format the counter as a 7-digit number (padded with zeros)
    const counterStr = counter.toString().padStart(7, '0');
    
    // Construct the final message ID
    const messageId = `MSG${dateStr}${counterStr}`;
    
    console.log(`[MessageID] Generated new message ID: ${messageId} (counter: ${counter})`);
    
    return messageId;
  } catch (error) {
    console.error('[MessageID] Error generating message ID:', error);
    
    // Fallback to timestamp-based ID if counter system fails
    const fallbackId = generateFallbackMessageId();
    console.warn(`[MessageID] Using fallback ID: ${fallbackId}`);
    
    return fallbackId;
  }
}

/**
 * Generate a fallback message ID using timestamp
 * Format: MSG{YYYYMMDD}{timestamp-last-7-digits}
 */
function generateFallbackMessageId(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
                 (now.getMonth() + 1).toString().padStart(2, '0') + 
                 now.getDate().toString().padStart(2, '0');
  
  // Use the last 7 digits of the timestamp as a fallback counter
  const timestamp = Date.now().toString();
  const fallbackCounter = timestamp.slice(-7);
  
  return `MSG${dateStr}${fallbackCounter}`;
}

/**
 * Validate if a string is a valid message ID
 * Supports both new format (MSG...) and legacy format (-...)
 */
export function isValidMessageId(messageId: string): boolean {
  if (!messageId || typeof messageId !== 'string') {
    return false;
  }

  // New format: MSG{YYYYMMDD}{7-digit-number}
  const newFormatRegex = /^MSG\d{8}\d{7}$/;
  
  // Legacy format: Firebase push ID (starts with -, contains alphanumeric and underscores)
  const legacyFormatRegex = /^-[A-Za-z0-9_-]+$/;
  
  return newFormatRegex.test(messageId) || legacyFormatRegex.test(messageId);
}

/**
 * Extract date from message ID (new format only)
 * Returns null for legacy format IDs
 */
export function extractDateFromMessageId(messageId: string): Date | null {
  if (!messageId || !messageId.startsWith('MSG')) {
    return null;
  }

  try {
    // Extract YYYYMMDD from MSG{YYYYMMDD}{7-digit-number}
    const dateStr = messageId.substring(3, 11); // Characters 3-10 (YYYYMMDD)
    
    if (dateStr.length !== 8) {
      return null;
    }

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    
    const date = new Date(year, month, day);
    
    // Validate the date is reasonable
    if (date.getFullYear() !== year || 
        date.getMonth() !== month || 
        date.getDate() !== day) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('[MessageID] Error extracting date from message ID:', error);
    return null;
  }
}

/**
 * Extract counter from message ID (new format only)
 * Returns null for legacy format IDs
 */
export function extractCounterFromMessageId(messageId: string): number | null {
  if (!messageId || !messageId.startsWith('MSG')) {
    return null;
  }

  try {
    // Extract 7-digit counter from MSG{YYYYMMDD}{7-digit-number}
    const counterStr = messageId.substring(11); // Characters 11+ (7-digit-number)
    
    if (counterStr.length !== 7) {
      return null;
    }

    const counter = parseInt(counterStr);
    
    if (isNaN(counter) || counter < 0) {
      return null;
    }
    
    return counter;
  } catch (error) {
    console.error('[MessageID] Error extracting counter from message ID:', error);
    return null;
  }
}

/**
 * Get the current counter for a specific date
 * Useful for monitoring and debugging
 */
export async function getCurrentCounter(date?: Date): Promise<number> {
  try {
    const { database } = getFirebaseServices();
    if (!database) {
      throw new Error('Database connection not available');
    }

    const targetDate = date || new Date();
    const dateStr = targetDate.getFullYear().toString() + 
                   (targetDate.getMonth() + 1).toString().padStart(2, '0') + 
                   targetDate.getDate().toString().padStart(2, '0');

    const counterRef = ref(database, `${COUNTER_PATH}/${dateStr}`);
    const snapshot = await get(counterRef);
    
    return snapshot.val() || 0;
  } catch (error) {
    console.error('[MessageID] Error getting current counter:', error);
    return 0;
  }
}

/**
 * Reset counter for a specific date (admin function)
 * Should only be used for maintenance or testing
 */
export async function resetCounter(date: Date, newValue: number = 0): Promise<boolean> {
  try {
    const { database } = getFirebaseServices();
    if (!database) {
      throw new Error('Database connection not available');
    }

    const dateStr = date.getFullYear().toString() + 
                   (date.getMonth() + 1).toString().padStart(2, '0') + 
                   date.getDate().toString().padStart(2, '0');

    const counterRef = ref(database, `${COUNTER_PATH}/${dateStr}`);
    await set(counterRef, newValue);
    
    console.log(`[MessageID] Reset counter for ${dateStr} to ${newValue}`);
    return true;
  } catch (error) {
    console.error('[MessageID] Error resetting counter:', error);
    return false;
  }
}

/**
 * Get statistics about message ID generation
 * Useful for monitoring system usage
 */
export async function getMessageIdStats(): Promise<{
  todayCount: number;
  yesterdayCount: number;
  totalDays: number;
  oldestDate: string | null;
  newestDate: string | null;
}> {
  try {
    const { database } = getFirebaseServices();
    if (!database) {
      throw new Error('Database connection not available');
    }

    const countersRef = ref(database, COUNTER_PATH);
    const snapshot = await get(countersRef);
    const counters = snapshot.val() || {};

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0');

    const yesterdayStr = yesterday.getFullYear().toString() + 
                        (yesterday.getMonth() + 1).toString().padStart(2, '0') + 
                        yesterday.getDate().toString().padStart(2, '0');

    const dates = Object.keys(counters).sort();

    return {
      todayCount: counters[todayStr] || 0,
      yesterdayCount: counters[yesterdayStr] || 0,
      totalDays: dates.length,
      oldestDate: dates.length > 0 ? dates[0] : null,
      newestDate: dates.length > 0 ? dates[dates.length - 1] : null
    };
  } catch (error) {
    console.error('[MessageID] Error getting message ID stats:', error);
    return {
      todayCount: 0,
      yesterdayCount: 0,
      totalDays: 0,
      oldestDate: null,
      newestDate: null
    };
  }
}