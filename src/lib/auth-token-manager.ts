import { User } from 'firebase/auth';

// Token refresh mechanism with better error handling and retry logic
export async function refreshAuthToken(user: User | null): Promise<string | null> {
  if (!user) {
    console.log('No user available for token refresh');
    return null;
  }

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to refresh auth token (attempt ${retryCount + 1}/${maxRetries})...`);
      const token = await user.getIdToken(true);
      console.log('Auth token refreshed successfully');
      return token;
    } catch (error) {
      console.error(`Token refresh error (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
      console.log(`Waiting ${delay}ms before next token refresh attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retryCount++;
    }
  }

  console.error('Failed to refresh auth token after multiple attempts');
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