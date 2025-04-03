/**
 * Capitalizes the first letter of each word in a string.
 * @param str The input string to be capitalized.
 * @returns A new string with the first letter of each word capitalized.
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
* Truncates a string to a specified length and adds an ellipsis if truncated.
* @param str The input string to be truncated.
* @param maxLength The maximum length of the truncated string (including ellipsis).
* @returns A truncated string with ellipsis if necessary.
*/
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
      return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
* Removes all whitespace from a string.
* @param str The input string to remove whitespace from.
* @returns A new string with all whitespace removed.
*/
export function removeWhitespace(str: string): string {
  return str.replace(/\s/g, '');
}

/**
* Checks if a string contains any explicit or inappropriate words.
* @param text The input string to check.
* @returns True if the text contains explicit content, false otherwise.
*/
export function containsExplicitContent(text: string | null | undefined): boolean {
  // Return false if text is null or undefined
  if (text === null || text === undefined) {
    return false;
  }
  
  // List of explicit words to filter (can be expanded)
  const explicitWords = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'porn', 'nsfw',
    // Add more words as needed
  ];

  const normalizedText = String(text).toLowerCase();
  return explicitWords.some(word => 
    normalizedText.includes(word.toLowerCase()) ||
    // Check for common letter substitutions
    normalizedText.replace(/[^a-zA-Z0-9]/g, '').includes(word.toLowerCase())
  );
}

/**
* Validates text length and content appropriateness.
* @param text The input string to validate.
* @param maxLength The maximum allowed length.
* @returns An object containing validation result and error message if any.
*/
export function validateTextContent(text: string | null | undefined, maxLength: number): { isValid: boolean; error?: string } {
  // Handle null or undefined values
  if (text === null || text === undefined) {
    return { isValid: false, error: 'Text cannot be empty' };
  }

  if (text.trim().length === 0) {
    return { isValid: false, error: 'Text cannot be empty' };
  }

  if (text.length > maxLength) {
    return { isValid: false, error: `Text must be ${maxLength} characters or less` };
  }

  if (containsExplicitContent(text)) {
    return { isValid: false, error: 'Text contains inappropriate content' };
  }

  return { isValid: true };
}