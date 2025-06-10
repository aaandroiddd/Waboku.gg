/**
 * Converts a Firebase Storage URL to a clean proxy URL
 * @param firebaseUrl - The original Firebase Storage URL
 * @returns Clean proxy URL or the original URL if conversion fails
 */
export function getCleanImageUrl(firebaseUrl: string): string {
  try {
    // Parse the Firebase Storage URL
    const url = new URL(firebaseUrl);
    
    // Extract the path from the Firebase URL
    const pathMatch = url.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch) {
      console.warn('Could not parse Firebase URL path:', firebaseUrl);
      return firebaseUrl; // Return original if we can't parse it
    }
    
    // Get the encoded path from the URL
    const encodedPath = pathMatch[1];
    
    // Try to decode the path carefully
    let decodedPath;
    try {
      // First attempt: standard decode
      decodedPath = decodeURIComponent(encodedPath);
      
      // Check if it needs another decode (double-encoded case)
      if (decodedPath.includes('%') && decodedPath.includes('/')) {
        try {
          const doubleDecoded = decodeURIComponent(decodedPath);
          if (doubleDecoded !== decodedPath) {
            decodedPath = doubleDecoded;
          }
        } catch (e) {
          // Keep the single decode if double decode fails
        }
      }
    } catch (error) {
      // If decoding fails, use the encoded path as-is
      console.warn('Failed to decode path, using encoded version:', encodedPath);
      decodedPath = encodedPath;
    }
    
    // Create our clean proxy URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const cleanUrl = `${baseUrl}/api/images/${decodedPath}`;
    
    console.log('Converting Firebase URL to clean URL:');
    console.log('  Original:', firebaseUrl);
    console.log('  Encoded path:', encodedPath);
    console.log('  Decoded path:', decodedPath);
    console.log('  Clean URL:', cleanUrl);
    
    return cleanUrl;
    
  } catch (error) {
    console.error('Error converting Firebase URL to clean URL:', error);
    return firebaseUrl; // Return original URL if conversion fails
  }
}

/**
 * Extracts the filename from a Firebase Storage URL or clean proxy URL
 * @param imageUrl - The image URL
 * @returns The filename or a default name
 */
export function getImageFilename(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Remove any query parameters and decode
    const cleanFilename = decodeURIComponent(filename.split('?')[0]);
    
    return cleanFilename || 'image';
  } catch (error) {
    return 'image';
  }
}