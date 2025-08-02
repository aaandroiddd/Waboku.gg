/**
 * Utility functions for handling user avatars, especially Google user photos
 */

/**
 * Enhances Google user photo URLs to get higher quality images
 * @param photoURL - The original photo URL from Firebase Auth
 * @returns Enhanced URL with higher quality parameters
 */
export function enhanceGoogleAvatarQuality(photoURL: string | null | undefined): string | null {
  if (!photoURL) return null;
  
  try {
    // Check if this is a Google user photo URL
    if (photoURL.includes('googleusercontent.com') || photoURL.includes('lh3.googleusercontent.com')) {
      // Remove existing size parameters and add high quality ones
      let enhancedUrl = photoURL.split('=')[0]; // Remove everything after '='
      
      // Add high quality parameters
      // s512 = 512x512 pixels (high quality)
      // c = crop to square
      // no = no overlay
      enhancedUrl += '=s512-c';
      
      console.log('Enhanced Google avatar URL:', {
        original: photoURL,
        enhanced: enhancedUrl
      });
      
      return enhancedUrl;
    }
    
    // For non-Google URLs, return as-is
    return photoURL;
  } catch (error) {
    console.error('Error enhancing Google avatar URL:', error);
    return photoURL; // Return original URL if enhancement fails
  }
}

/**
 * Gets the best available avatar URL for a user
 * @param user - Firebase user object
 * @param profile - User profile from Firestore
 * @returns The best quality avatar URL available
 */
export function getBestAvatarUrl(user: any, profile: any): string | null {
  // Priority order:
  // 1. Enhanced profile avatarUrl (if it's a Google photo)
  // 2. Enhanced user photoURL (if it's a Google photo)
  // 3. Profile avatarUrl (custom uploaded)
  // 4. User photoURL (fallback)
  
  const profileAvatarUrl = profile?.avatarUrl || profile?.photoURL;
  const userPhotoURL = user?.photoURL;
  
  // Try to enhance profile avatar URL first
  if (profileAvatarUrl) {
    const enhanced = enhanceGoogleAvatarQuality(profileAvatarUrl);
    if (enhanced && enhanced !== profileAvatarUrl) {
      return enhanced; // Return enhanced version if it was improved
    }
    return profileAvatarUrl; // Return original if not a Google photo
  }
  
  // Try to enhance user photo URL
  if (userPhotoURL) {
    const enhanced = enhanceGoogleAvatarQuality(userPhotoURL);
    if (enhanced && enhanced !== userPhotoURL) {
      return enhanced; // Return enhanced version if it was improved
    }
    return userPhotoURL; // Return original if not a Google photo
  }
  
  return null;
}

/**
 * Checks if a URL is a Google user photo
 * @param url - The URL to check
 * @returns True if it's a Google user photo URL
 */
export function isGooglePhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('googleusercontent.com') || url.includes('lh3.googleusercontent.com');
}

/**
 * Gets multiple sizes of a Google avatar for responsive images
 * @param photoURL - The original Google photo URL
 * @returns Object with different sizes
 */
export function getGoogleAvatarSizes(photoURL: string | null | undefined) {
  if (!photoURL || !isGooglePhotoUrl(photoURL)) {
    return {
      small: photoURL,
      medium: photoURL,
      large: photoURL,
      xlarge: photoURL
    };
  }
  
  const baseUrl = photoURL.split('=')[0];
  
  return {
    small: `${baseUrl}=s96-c`,   // 96x96 for small avatars
    medium: `${baseUrl}=s128-c`, // 128x128 for medium avatars
    large: `${baseUrl}=s256-c`,  // 256x256 for large avatars
    xlarge: `${baseUrl}=s512-c`  // 512x512 for extra large avatars
  };
}