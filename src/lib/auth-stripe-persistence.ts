/**
 * Helper functions for maintaining authentication state during Stripe checkout flow
 */

// Key for storing auth state in localStorage
const AUTH_PERSISTENCE_KEY = 'waboku_stripe_auth_state';
const AUTH_TOKEN_KEY = 'waboku_stripe_auth_token';

/**
 * Store authentication state before redirecting to Stripe
 * @param userId User ID to store
 * @param email User email to store
 */
export async function storeAuthStateForStripe(userId: string, email: string) {
  try {
    if (typeof window !== 'undefined') {
      // Store basic auth state
      const authState = {
        userId,
        email,
        timestamp: Date.now(),
        returnPath: window.location.pathname
      };
      
      localStorage.setItem(AUTH_PERSISTENCE_KEY, JSON.stringify(authState));
      
      // Try to get and store the auth token for more reliable restoration
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken(true);
          // Store token in a separate key for security
          sessionStorage.setItem(AUTH_TOKEN_KEY, token);
          console.log('[Auth Persistence] Stored auth token for Stripe redirect');
        }
      } catch (tokenError) {
        console.warn('[Auth Persistence] Could not store auth token:', tokenError);
        // Continue without token - we'll still have the basic auth state
      }
      
      console.log('[Auth Persistence] Stored auth state for Stripe redirect');
    }
  } catch (error) {
    console.error('[Auth Persistence] Error storing auth state:', error);
  }
}

/**
 * Retrieve stored authentication state after returning from Stripe
 */
export function getStoredAuthState() {
  try {
    if (typeof window !== 'undefined') {
      const storedState = localStorage.getItem(AUTH_PERSISTENCE_KEY);
      if (storedState) {
        const authState = JSON.parse(storedState);
        
        // Check if the state is still valid (less than 1 hour old)
        const now = Date.now();
        const isValid = now - authState.timestamp < 60 * 60 * 1000; // 1 hour
        
        if (isValid) {
          console.log('[Auth Persistence] Retrieved valid auth state');
          return authState;
        } else {
          console.log('[Auth Persistence] Auth state expired, clearing');
          clearStoredAuthState();
        }
      }
    }
    return null;
  } catch (error) {
    console.error('[Auth Persistence] Error retrieving auth state:', error);
    return null;
  }
}

/**
 * Get the stored auth token if available
 * @returns The stored auth token or null
 */
export function getStoredAuthToken() {
  try {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        console.log('[Auth Persistence] Retrieved stored auth token');
        return token;
      }
    }
    return null;
  } catch (error) {
    console.error('[Auth Persistence] Error retrieving auth token:', error);
    return null;
  }
}

/**
 * Clear stored authentication state
 */
export function clearStoredAuthState() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    console.error('[Auth Persistence] Error clearing auth state:', error);
  }
}

/**
 * Check if we're returning from a Stripe checkout
 */
export function isReturningFromStripe() {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    return url.searchParams.has('session_id') || url.searchParams.has('upgrade');
  }
  return false;
}

/**
 * Attempt to restore authentication after returning from Stripe
 * This function tries to reconnect Firebase and restore the auth state
 */
export async function attemptAuthRestoration() {
  try {
    console.log('[Auth Persistence] Attempting to restore authentication after Stripe redirect');
    
    // Check if we have stored auth state
    const authState = getStoredAuthState();
    if (!authState) {
      console.log('[Auth Persistence] No stored auth state found');
      return false;
    }
    
    // Try to reconnect Firebase first
    try {
      const { connectionManager } = await import('@/lib/firebase');
      if (connectionManager) {
        await connectionManager.reconnectFirebase();
        console.log('[Auth Persistence] Firebase reconnection attempted');
      }
    } catch (reconnectError) {
      console.error('[Auth Persistence] Error reconnecting Firebase:', reconnectError);
    }
    
    // Try to restore auth state using the stored token
    const token = getStoredAuthToken();
    if (token) {
      try {
        const { getAuth, signInWithCustomToken } = await import('firebase/auth');
        const auth = getAuth();
        
        // If we're already signed in with the correct user, no need to do anything
        if (auth.currentUser && auth.currentUser.uid === authState.userId) {
          console.log('[Auth Persistence] Already signed in as the correct user');
          return true;
        }
        
        // Otherwise, try to use the token to restore the session
        // Note: This is a simplified approach - in a real implementation,
        // you would need a server endpoint to exchange the stored token for a custom token
        
        // For now, we'll just return true if we have auth state and a token
        console.log('[Auth Persistence] Auth token found, but custom token sign-in not implemented');
        return true;
      } catch (signInError) {
        console.error('[Auth Persistence] Error signing in with token:', signInError);
      }
    }
    
    // If we have auth state but couldn't restore the session, return true anyway
    // so the app knows we're returning from Stripe
    return true;
  } catch (error) {
    console.error('[Auth Persistence] Error restoring authentication:', error);
    return false;
  }
}