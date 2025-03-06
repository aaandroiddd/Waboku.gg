import { User } from 'firebase/auth';

// Enhanced token refresh mechanism with better error handling and retry logic
export async function refreshAuthToken(user: User | null): Promise<string | null> {
  if (!user) {
    console.log('No user available for token refresh');
    return null;
  }
  
  // Check if Firebase API key is properly configured
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.error('Firebase API key is missing or invalid');
    return null;
  }

  let retryCount = 0;
  const maxRetries = 5; // Increased from 3 to 5 for more resilience

  // Store the last successful token refresh time
  const lastRefreshKey = `waboku_last_token_refresh_${user.uid}`;
  let lastRefreshTime = 0;
  
  try {
    const storedTime = localStorage.getItem(lastRefreshKey);
    if (storedTime) {
      lastRefreshTime = parseInt(storedTime, 10);
    }
  } catch (e) {
    console.warn('Could not access localStorage for token refresh timing');
  }
  
  // Only refresh if it's been more than 5 minutes since the last refresh
  // This prevents excessive token refreshes which can trigger rate limits
  const now = Date.now();
  const fiveMinutesMs = 5 * 60 * 1000;
  
  if (now - lastRefreshTime < fiveMinutesMs) {
    console.log('Token was refreshed recently, skipping refresh');
    try {
      // Just get the current token without forcing refresh
      return await user.getIdToken(false);
    } catch (e) {
      console.warn('Error getting current token, will force refresh:', e);
      // Continue with forced refresh
    }
  }

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to refresh auth token (attempt ${retryCount + 1}/${maxRetries})...`);
      
      // Force token refresh
      const token = await user.getIdToken(true);
      console.log('Auth token refreshed successfully');
      
      // Store the successful refresh time
      try {
        localStorage.setItem(lastRefreshKey, now.toString());
      } catch (e) {
        console.warn('Could not store token refresh time in localStorage');
      }
      
      return token;
    } catch (error) {
      console.error(`Token refresh error (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // Check if this is a network error or a Firebase Auth error
      const errorMessage = error.message || '';
      const isNetworkError = errorMessage.includes('network') || 
                             errorMessage.includes('timeout') || 
                             errorMessage.includes('connection');
      
      // For network errors, we'll retry with longer delays
      // For auth errors, we might not be able to recover without user intervention
      if (isNetworkError || retryCount < 2) {
        // Exponential backoff with jitter to prevent thundering herd
        const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
        const delay = baseDelay + jitter;
        
        console.log(`Waiting ${Math.round(delay)}ms before next token refresh attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retryCount++;
      } else {
        // For non-network errors after a couple of retries, we'll try to get a non-forced token
        // This might work if the token is still valid but there's an issue with the refresh
        try {
          console.log('Attempting to get current token without forcing refresh...');
          const currentToken = await user.getIdToken(false);
          console.log('Successfully retrieved current token without forcing refresh');
          
          // Store the access time, but not as a full refresh
          try {
            localStorage.setItem(`waboku_token_access_${user.uid}`, now.toString());
          } catch (e) {
            console.warn('Could not store token access time in localStorage');
          }
          
          return currentToken;
        } catch (nonForceError) {
          console.error('Failed to get current token without forcing refresh:', nonForceError);
          
          // If we've exhausted all retries, we'll return null
          if (retryCount >= maxRetries - 1) {
            break;
          }
          
          // Otherwise, continue with the retry loop
          retryCount++;
        }
      }
    }
  }

  console.error('Failed to refresh auth token after multiple attempts');
  // Return null but don't throw an error - the calling code should handle this gracefully
  return null;
}

// Function to check if user session is valid
export async function validateUserSession(user: User | null): Promise<boolean> {
  if (!user) {
    console.log('No user to validate');
    return false;
  }

  try {
    // Try to reload the user to check if the session is still valid
    await user.reload();
    console.log('User session validated successfully');
    return true;
  } catch (error) {
    console.error('User session validation failed:', error);
    return false;
  }
}

// Function to handle auth state persistence
export function storeAuthState(userId: string | null) {
  if (typeof window === 'undefined' || !userId) return;
  
  try {
    localStorage.setItem('waboku_auth_state', JSON.stringify({
      uid: userId,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error storing auth state:', error);
  }
}

export function getStoredAuthState(): { uid: string, timestamp: number } | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const storedState = localStorage.getItem('waboku_auth_state');
    if (!storedState) return null;
    
    const parsedState = JSON.parse(storedState);
    
    // Check if state is still valid (less than 24 hours old)
    if (Date.now() - parsedState.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('waboku_auth_state');
      return null;
    }
    
    return parsedState;
  } catch (error) {
    console.error('Error retrieving auth state:', error);
    return null;
  }
}

export function clearAuthState() {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('waboku_auth_state');
  } catch (error) {
    console.error('Error clearing auth state:', error);
  }
}

/**
 * Clears any stored authentication data from localStorage
 */
export const clearStoredAuthData = (): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Clear auth redirect state
      localStorage.removeItem('waboku_auth_redirect');
      localStorage.removeItem('waboku_auth_state');
      
      // Clear any token refresh timestamps
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('waboku_last_token_refresh_') || 
          key.startsWith('waboku_token_access_')
        )) {
          keysToRemove.push(key);
        }
      }
      
      // Remove the keys in a separate loop to avoid issues with changing localStorage during iteration
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear profile completion flag
      localStorage.removeItem('needs_profile_completion');
    }
  } catch (e) {
    console.warn('Error clearing stored auth data:', e);
  }
};

/**
 * Checks if there are any stale auth tokens or data in localStorage
 * @returns true if stale data was found and cleared, false otherwise
 */
/**
 * Gets the current user's auth token with optional force refresh
 * @param forceRefresh Whether to force a token refresh
 * @returns The auth token or null if not available
 */
export async function getAuthToken(forceRefresh: boolean = false): Promise<string | null> {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('getAuthToken called in non-browser environment');
      return null;
    }
    
    // Import Firebase auth dynamically to avoid SSR issues
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    
    if (!auth) {
      console.error('Firebase auth not initialized');
      return null;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No user is currently signed in');
      return null;
    }
    
    // Add retry logic for token fetch
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const token = await currentUser.getIdToken(forceRefresh);
        return token;
      } catch (tokenError: any) {
        attempts++;
        console.warn(`Token fetch attempt ${attempts} failed:`, tokenError.message);
        
        // If this is a network error, wait and retry
        if (tokenError.code === 'auth/network-request-failed' && attempts < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempts - 1) * 1000;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempts >= maxAttempts) {
          console.error('Max token fetch attempts reached');
          return null;
        } else {
          throw tokenError;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

export const checkAndClearStaleAuthData = (): boolean => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      let staleDataFound = false;
      
      // Check for auth redirect state
      const storedAuth = localStorage.getItem('waboku_auth_redirect');
      if (storedAuth) {
        try {
          const authData = JSON.parse(storedAuth);
          const now = Date.now();
          const storedTime = authData.timestamp || 0;
          
          // If stored auth is more than 30 minutes old, it's stale
          if (now - storedTime > 30 * 60 * 1000) {
            localStorage.removeItem('waboku_auth_redirect');
            staleDataFound = true;
          }
        } catch (e) {
          // If we can't parse the data, it's corrupted, so remove it
          localStorage.removeItem('waboku_auth_redirect');
          staleDataFound = true;
        }
      }
      
      // Check for auth state
      const storedState = localStorage.getItem('waboku_auth_state');
      if (storedState) {
        try {
          const stateData = JSON.parse(storedState);
          const now = Date.now();
          const storedTime = stateData.timestamp || 0;
          
          // If stored state is more than 24 hours old, it's stale
          if (now - storedTime > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('waboku_auth_state');
            staleDataFound = true;
          }
        } catch (e) {
          // If we can't parse the data, it's corrupted, so remove it
          localStorage.removeItem('waboku_auth_state');
          staleDataFound = true;
        }
      }
      
      // Check for token refresh timestamps
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('waboku_last_token_refresh_') || 
          key.startsWith('waboku_token_access_')
        )) {
          try {
            const timestamp = parseInt(localStorage.getItem(key) || '0', 10);
            const now = Date.now();
            
            // If timestamp is more than 24 hours old, it's stale
            if (now - timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem(key);
              staleDataFound = true;
            }
          } catch (e) {
            // If we can't parse the timestamp, it's corrupted, so remove it
            localStorage.removeItem(key);
            staleDataFound = true;
          }
        }
      }
      
      return staleDataFound;
    }
  } catch (e) {
    console.warn('Error checking for stale auth data:', e);
  }
  
  return false;
};