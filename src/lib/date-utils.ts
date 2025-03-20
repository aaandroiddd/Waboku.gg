/**
 * Utility functions for handling dates in the application
 */

/**
 * Safely parses a date from various formats that might come from Firestore or API
 * @param dateValue - The date value to parse (could be Date, string, Firestore timestamp, etc.)
 * @param fallbackDate - Optional fallback date to use if parsing fails (defaults to current date)
 * @returns A valid JavaScript Date object
 */
export function parseDate(dateValue: any, fallbackDate: Date = new Date()): Date {
  try {
    // Handle if it's already a Date
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Handle Firestore timestamp with toDate method
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Handle Firestore timestamp in serialized form
    if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
      return new Date(dateValue.seconds * 1000);
    }
    
    // Handle string date format (common when data comes from API)
    if (dateValue && typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue);
      
      // Validate the date is valid
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      
      // If invalid string date, throw to use fallback
      throw new Error('Invalid date string');
    }
    
    // Handle numeric timestamp
    if (dateValue && typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    
    // If we get here, try a generic conversion
    const genericDate = new Date(dateValue);
    if (!isNaN(genericDate.getTime())) {
      return genericDate;
    }
    
    // If all else fails, throw to use fallback
    throw new Error('Could not parse date');
  } catch (error) {
    console.error('Error parsing date:', error, 'Value was:', dateValue);
    return fallbackDate;
  }
}

/**
 * Creates a future date based on the current date plus a specified number of hours
 * @param hours - Number of hours to add to the current date
 * @returns A Date object representing the future time
 */
export function createFutureDate(hours: number): Date {
  const futureDate = new Date();
  futureDate.setHours(futureDate.getHours() + hours);
  return futureDate;
}

/**
 * Checks if a date is in the past (has expired)
 * @param date - The date to check
 * @returns True if the date is in the past, false otherwise
 */
export function isExpired(date: Date | string | any): boolean {
  const parsedDate = parseDate(date);
  return new Date() > parsedDate;
}

/**
 * Formats a date for display in the UI
 * @param date - The date to format
 * @param includeTime - Whether to include the time in the formatted string
 * @returns A formatted date string
 */
export function formatDate(date: Date | string | any, includeTime: boolean = false): string {
  try {
    const parsedDate = parseDate(date);
    
    if (includeTime) {
      return parsedDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}