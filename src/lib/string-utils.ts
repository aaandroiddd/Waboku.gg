/**
 * Utility functions for safe string operations
 */

/**
 * Safely checks if a string includes a substring
 * @param str - The string to check (can be undefined, null, or any type)
 * @param searchString - The substring to search for
 * @returns boolean - true if the string contains the substring, false otherwise
 */
export function safeIncludes(str: any, searchString: string): boolean {
  try {
    // Check if str is null, undefined, or not a string
    if (str == null || typeof str !== 'string') {
      return false;
    }
    
    // Check if searchString is valid
    if (typeof searchString !== 'string') {
      return false;
    }
    
    // Perform the includes check
    return str.includes(searchString);
  } catch (error) {
    console.warn('Error in safeIncludes:', error, { str, searchString });
    return false;
  }
}

/**
 * Safely converts any value to a string
 * @param value - The value to convert
 * @returns string - The string representation or empty string if conversion fails
 */
export function safeToString(value: any): string {
  try {
    if (value == null) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    return String(value);
  } catch (error) {
    console.warn('Error in safeToString:', error, { value });
    return '';
  }
}

/**
 * Safely checks if a className string contains a specific class
 * @param className - The className string (can be undefined, null, or any type)
 * @param targetClass - The class to search for
 * @returns boolean - true if the className contains the target class, false otherwise
 */
export function hasClass(className: any, targetClass: string): boolean {
  try {
    const classStr = safeToString(className);
    
    if (!classStr || !targetClass) {
      return false;
    }
    
    // Split by whitespace and check if any class matches exactly
    const classes = classStr.split(/\s+/).filter(Boolean);
    return classes.includes(targetClass);
  } catch (error) {
    console.warn('Error in hasClass:', error, { className, targetClass });
    return false;
  }
}

/**
 * Safely gets the length of a string
 * @param str - The string to check
 * @returns number - The length of the string or 0 if not a valid string
 */
export function safeLength(str: any): number {
  try {
    if (typeof str === 'string') {
      return str.length;
    }
    return 0;
  } catch (error) {
    console.warn('Error in safeLength:', error, { str });
    return 0;
  }
}