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
 * Enhanced with better error handling and more comprehensive cleanup
 */
export const clearStoredAuthData = (): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.log('localStorage not available for auth data clearing');
      return;
    }
    
    console.log('Starting to clear stored auth data...');
    
    // Mark sign-out in progress to prevent race conditions
    try {
      localStorage.setItem('waboku_signout_in_progress', 'true');
    } catch (e) {
      console.warn('Could not set sign-out in progress flag:', e);
    }
    
    // List of specific keys to remove
    const specificKeys = [
      'waboku_auth_redirect',
      'waboku_auth_state',
      'needs_profile_completion',
      'firebase:authUser',
      'firebase:previousAuthUser'
    ];
    
    // Remove specific keys
    specificKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (keyError) {
        console.warn(`Failed to remove ${key} from localStorage:`, keyError);
      }
    });
    
    // Find and remove all keys with specific prefixes
    const prefixesToRemove = [
      'waboku_last_token_refresh_',
      'waboku_token_access_',
      'firebase:',
      'profile_'
    ];
    
    // Collect keys to remove
    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && prefixesToRemove.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
    } catch (iterationError) {
      console.warn('Error iterating through localStorage keys:', iterationError);
    }
    
    // Remove collected keys in a separate step
    if (keysToRemove.length > 0) {
      console.log(`Found ${keysToRemove.length} auth-related items to remove from localStorage`);
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (removeError) {
          console.warn(`Failed to remove ${key} from localStorage:`, removeError);
        }
      });
    }
    
    // Try to clear session storage as well
    try {
      if (window.sessionStorage) {
        // Clear Firebase-related session storage items
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('firebase:')) {
            sessionStorage.removeItem(key);
          }
        }
      }
    } catch (sessionError) {
      console.warn('Error clearing session storage:', sessionError);
    }
    
    // Clear IndexedDB Firebase storage if possible
    try {
      const clearFirebaseIDB = async () => {
        // List of common Firebase IndexedDB database names
        const possibleDBNames = [
          'firebaseLocalStorage',
          'firebase-auth-state',
          'firebase-auth',
          'firestore'
        ];
        
        for (const dbName of possibleDBNames) {
          try {
            // Try to delete the database
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            
            // Set up event handlers
            deleteRequest.onsuccess = () => {
              console.log(`Successfully deleted IndexedDB database: ${dbName}`);
            };
            
            deleteRequest.onerror = () => {
              console.warn(`Error deleting IndexedDB database: ${dbName}`);
            };
          } catch (idbError) {
            console.warn(`Error attempting to delete IndexedDB database ${dbName}:`, idbError);
          }
        }
      };
      
      // Execute the async function
      clearFirebaseIDB().catch(e => {
        console.warn('Error clearing Firebase IndexedDB databases:', e);
      });
    } catch (idbError) {
      console.warn('Error accessing IndexedDB:', idbError);
    }
    
    // Clear the sign-out in progress flag
    try {
      localStorage.removeItem('waboku_signout_in_progress');
    } catch (e) {
      console.warn('Could not clear sign-out in progress flag:', e);
    }
    
    console.log('Completed clearing stored auth data');
  } catch (e) {
    console.error('Error during auth data clearing process:', e);
    // Even if there's an error, try to remove the most critical items
    try {
      localStorage.removeItem('waboku_auth_redirect');
      localStorage.removeItem('waboku_auth_state');
      localStorage.removeItem('waboku_signout_in_progress');
    } catch (fallbackError) {
      console.error('Critical error clearing auth data:', fallbackError);
    }
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
        // Use a timeout promise to prevent hanging
        const tokenPromise = currentUser.getIdToken(forceRefresh);
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Token fetch timeout')), 10000); // 10 second timeout
        });
        
        // Race the token fetch against the timeout
        const token = await Promise.race([tokenPromise, timeoutPromise]) as string;
        
        // Store the successful token fetch time
        try {
          const lastRefreshKey = `waboku_last_token_refresh_${currentUser.uid}`;
          localStorage.setItem(lastRefreshKey, Date.now().toString());
        } catch (e) {
          console.warn('Could not store token refresh time in localStorage');
        }
        
        return token;
      } catch (tokenError: any) {
        attempts++;
        console.warn(`Token fetch attempt ${attempts} failed:`, tokenError.message);
        
        // If this is a network error or timeout, wait and retry
        const isNetworkError = tokenError.code === 'auth/network-request-failed' || 
                              tokenError.message.includes('timeout') ||
                              tokenError.message.includes('network');
        
        if (isNetworkError && attempts < maxAttempts) {
          // Exponential backoff with jitter: ~1s, ~2s, ~4s
          const baseDelay = Math.pow(2, attempts - 1) * 1000;
          const jitter = Math.random() * 500; // Add up to 500ms of random jitter
          const delay = baseDelay + jitter;
          
          console.log(`Waiting ${Math.round(delay)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempts >= maxAttempts) {
          console.error('Max token fetch attempts reached');
          
          // On final attempt, try to get a non-forced token as fallback
          if (forceRefresh) {
            try {
              console.log('Attempting to get current token without forcing refresh as fallback...');
              return await currentUser.getIdToken(false);
            } catch (fallbackError) {
              console.error('Fallback token fetch also failed:', fallbackError);
              return null;
            }
          }
          return null;
        } else {
          // For non-network errors that we can't recover from
          console.error('Non-recoverable token fetch error:', tokenError);
          return null;
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