import { User } from 'firebase/auth';

// Enhanced token refresh mechanism with better error handling and retry logic
export async function refreshAuthToken(user: User | null): Promise<string | null> {
  if (!user) {
    console.log('No user available for token refresh');
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