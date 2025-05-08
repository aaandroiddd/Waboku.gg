/**
 * Firebase Authentication Rate Limiter
 * 
 * This module implements rate limiting for Firebase Authentication operations
 * to prevent QUOTA_EXCEEDED errors by throttling token refresh requests.
 */

// Token refresh rate limiting configuration
const TOKEN_REFRESH_MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes minimum between forced refreshes (increased from 10)
const TOKEN_REFRESH_JITTER_MS = 10 * 60 * 1000; // Add up to 10 minutes of jitter (increased from 2)
const GLOBAL_RATE_LIMIT_MS = 30 * 1000; // 30 seconds global rate limit (increased from 5 seconds)
const QUOTA_EXCEEDED_BACKOFF_MS = 60 * 60 * 1000; // 1 hour backoff after quota exceeded

// Track the last refresh time globally
let lastTokenRefreshTime = 0;

// Track refresh times per user
const userRefreshTimes: Record<string, number> = {};

/**
 * Checks if a token refresh should be allowed based on rate limiting rules
 * @param userId The user ID requesting a token refresh
 * @param forceRefresh Whether this is a forced refresh request
 * @returns Boolean indicating if the refresh should be allowed
 */
export function shouldAllowTokenRefresh(userId: string, forceRefresh: boolean = true): boolean {
  const now = Date.now();
  
  // For non-forced refreshes, always allow
  if (!forceRefresh) {
    return true;
  }
  
  // Check global rate limit first
  const timeSinceLastGlobalRefresh = now - lastTokenRefreshTime;
  if (timeSinceLastGlobalRefresh < GLOBAL_RATE_LIMIT_MS) {
    console.log(`[Auth Rate Limiter] Global rate limit hit. Last refresh was ${Math.round(timeSinceLastGlobalRefresh / 1000)}s ago, limit is ${GLOBAL_RATE_LIMIT_MS / 1000}s`);
    return false;
  }
  
  // Check if we've hit a quota exceeded error recently
  const quotaExceededTime = getQuotaExceededTime();
  if (quotaExceededTime) {
    const timeSinceQuotaExceeded = now - quotaExceededTime;
    if (timeSinceQuotaExceeded < QUOTA_EXCEEDED_BACKOFF_MS) {
      console.log(`[Auth Rate Limiter] Quota exceeded backoff in effect. ${Math.round((QUOTA_EXCEEDED_BACKOFF_MS - timeSinceQuotaExceeded) / 60000)}m remaining before retry allowed`);
      return false;
    } else {
      // Clear the quota exceeded flag if backoff period has passed
      clearQuotaExceededTime();
    }
  }
  
  // Then check per-user rate limit
  const userLastRefresh = userRefreshTimes[userId] || 0;
  const timeSinceUserRefresh = now - userLastRefresh;
  
  // Calculate minimum interval with jitter to prevent thundering herd
  const jitter = Math.floor(Math.random() * TOKEN_REFRESH_JITTER_MS);
  const minInterval = TOKEN_REFRESH_MIN_INTERVAL_MS + jitter;
  
  if (timeSinceUserRefresh < minInterval) {
    console.log(`[Auth Rate Limiter] User rate limit hit for ${userId}. Last refresh was ${Math.round(timeSinceUserRefresh / 1000)}s ago, minimum interval is ${Math.round(minInterval / 1000)}s`);
    return false;
  }
  
  return true;
}

/**
 * Records a token refresh attempt
 * @param userId The user ID that refreshed a token
 */
export function recordTokenRefresh(userId: string): void {
  const now = Date.now();
  lastTokenRefreshTime = now;
  userRefreshTimes[userId] = now;
  
  // Store in localStorage for persistence across page loads
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`waboku_last_token_refresh_${userId}`, now.toString());
      localStorage.setItem('waboku_last_global_token_refresh', now.toString());
    }
  } catch (e) {
    console.warn('[Auth Rate Limiter] Failed to store refresh time in localStorage:', e);
  }
}

/**
 * Loads stored refresh times from localStorage
 */
export function loadStoredRefreshTimes(): void {
  try {
    if (typeof window === 'undefined') return;
    
    // Load global refresh time
    const storedGlobalTime = localStorage.getItem('waboku_last_global_token_refresh');
    if (storedGlobalTime) {
      lastTokenRefreshTime = parseInt(storedGlobalTime, 10);
    }
    
    // Load user-specific refresh times
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('waboku_last_token_refresh_')) {
        const userId = key.replace('waboku_last_token_refresh_', '');
        const timestamp = localStorage.getItem(key);
        if (timestamp) {
          userRefreshTimes[userId] = parseInt(timestamp, 10);
        }
      }
    }
  } catch (e) {
    console.warn('[Auth Rate Limiter] Failed to load stored refresh times:', e);
  }
}

/**
 * Records a quota exceeded error to trigger the circuit breaker
 */
export function recordQuotaExceededError(): void {
  const now = Date.now();
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('waboku_auth_quota_exceeded_time', now.toString());
      console.warn(`[Auth Rate Limiter] Quota exceeded error recorded. Token refreshes blocked for ${QUOTA_EXCEEDED_BACKOFF_MS / 60000} minutes`);
    }
  } catch (e) {
    console.warn('[Auth Rate Limiter] Failed to store quota exceeded time:', e);
  }
}

/**
 * Gets the timestamp of the last quota exceeded error
 * @returns Timestamp of the last quota exceeded error or null if none
 */
function getQuotaExceededTime(): number | null {
  try {
    if (typeof window !== 'undefined') {
      const timestamp = localStorage.getItem('waboku_auth_quota_exceeded_time');
      return timestamp ? parseInt(timestamp, 10) : null;
    }
  } catch (e) {
    console.warn('[Auth Rate Limiter] Failed to get quota exceeded time:', e);
  }
  return null;
}

/**
 * Clears the quota exceeded timestamp
 */
function clearQuotaExceededTime(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('waboku_auth_quota_exceeded_time');
      console.log('[Auth Rate Limiter] Quota exceeded backoff period ended, token refreshes allowed again');
    }
  } catch (e) {
    console.warn('[Auth Rate Limiter] Failed to clear quota exceeded time:', e);
  }
}

// Initialize by loading stored refresh times
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure this runs after the page has loaded
  setTimeout(loadStoredRefreshTimes, 0);
}