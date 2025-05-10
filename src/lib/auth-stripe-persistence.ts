/**
 * Helper functions for maintaining authentication state during Stripe checkout flow
 */

// Key for storing auth state in localStorage
const AUTH_PERSISTENCE_KEY = 'waboku_stripe_auth_state';

/**
 * Store authentication state before redirecting to Stripe
 * @param userId User ID to store
 * @param email User email to store
 */
export function storeAuthStateForStripe(userId: string, email: string) {
  try {
    if (typeof window !== 'undefined') {
      const authState = {
        userId,
        email,
        timestamp: Date.now(),
        returnPath: window.location.pathname
      };
      
      localStorage.setItem(AUTH_PERSISTENCE_KEY, JSON.stringify(authState));
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
 * Clear stored authentication state
 */
export function clearStoredAuthState() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_PERSISTENCE_KEY);
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