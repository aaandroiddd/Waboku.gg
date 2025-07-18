/**
 * Analytics Error Handler
 * Handles and suppresses expected analytics errors from Stripe and PostHog
 * that occur when users have ad blockers or privacy extensions enabled
 */

// Track which errors we've already logged to avoid spam
const loggedErrors = new Set<string>();

/**
 * Initialize analytics error handling
 * This should be called early in the application lifecycle
 */
export function initializeAnalyticsErrorHandler() {
  if (typeof window === 'undefined') return;

  // Handle unhandled promise rejections for analytics services
  const originalUnhandledRejection = window.onunhandledrejection;
  
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason === 'object') {
      const error = event.reason;
      const errorMessage = error.message || '';
      const errorStack = error.stack || '';
      
      // Check if this is a Stripe analytics error
      if (errorMessage.includes('Failed to fetch') && 
          (errorStack.includes('stripe.com') || errorStack.includes('r.stripe.com'))) {
        
        const errorKey = 'stripe-analytics-blocked';
        if (!loggedErrors.has(errorKey)) {
          console.info('[Analytics] Stripe analytics blocked by ad blocker or privacy extension - this is expected behavior');
          loggedErrors.add(errorKey);
        }
        
        // Prevent the error from appearing in console
        event.preventDefault();
        return;
      }
      
      // Check if this is a PostHog analytics error
      if (errorMessage.includes('Failed to fetch') && 
          (errorStack.includes('posthog.com') || errorStack.includes('us.i.posthog.com'))) {
        
        const errorKey = 'posthog-analytics-blocked';
        if (!loggedErrors.has(errorKey)) {
          console.info('[Analytics] PostHog analytics blocked by ad blocker or privacy extension - this is expected behavior');
          loggedErrors.add(errorKey);
        }
        
        // Prevent the error from appearing in console
        event.preventDefault();
        return;
      }
    }
    
    // Call original handler if it exists
    if (originalUnhandledRejection) {
      originalUnhandledRejection.call(window, event);
    }
  });

  // Handle fetch errors for analytics services
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    try {
      return await originalFetch(input, init);
    } catch (error) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      
      // Handle Stripe analytics fetch errors
      if (url.includes('stripe.com') || url.includes('r.stripe.com')) {
        const errorKey = 'stripe-fetch-blocked';
        if (!loggedErrors.has(errorKey)) {
          console.info('[Analytics] Stripe analytics request blocked - this is expected with ad blockers');
          loggedErrors.add(errorKey);
        }
        
        // Return a mock successful response to prevent further errors
        return new Response('{}', { 
          status: 200, 
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Handle PostHog analytics fetch errors
      if (url.includes('posthog.com') || url.includes('us.i.posthog.com')) {
        const errorKey = 'posthog-fetch-blocked';
        if (!loggedErrors.has(errorKey)) {
          console.info('[Analytics] PostHog analytics request blocked - this is expected with ad blockers');
          loggedErrors.add(errorKey);
        }
        
        // Return a mock successful response to prevent further errors
        return new Response('{}', { 
          status: 200, 
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Re-throw other errors
      throw error;
    }
  };

  // Handle network errors that might be related to analytics
  window.addEventListener('error', (event) => {
    const error = event.error;
    const message = event.message || '';
    const filename = event.filename || '';
    
    // Check for analytics-related network errors
    if (message.includes('ERR_BLOCKED_BY_CLIENT') || 
        message.includes('net::ERR_BLOCKED_BY_CLIENT')) {
      
      if (filename.includes('stripe.com') || filename.includes('posthog.com')) {
        const errorKey = `network-blocked-${filename}`;
        if (!loggedErrors.has(errorKey)) {
          console.info('[Analytics] Analytics service blocked by client - this is expected behavior');
          loggedErrors.add(errorKey);
        }
        
        // Prevent the error from appearing in console
        event.preventDefault();
        return;
      }
    }
  });

  console.log('[Analytics] Analytics error handler initialized');
}

/**
 * Clear logged errors (useful for testing or debugging)
 */
export function clearLoggedErrors() {
  loggedErrors.clear();
}

/**
 * Get the count of suppressed analytics errors
 */
export function getSuppressedErrorCount() {
  return loggedErrors.size;
}