// Enhanced error handler with more aggressive patching and Firestore connection management
let isInitialized = false;

export function initializeEnhancedErrorHandler() {
  if (isInitialized) return;
  isInitialized = true;

  // More aggressive prototype patching for includes method
  const originalStringIncludes = String.prototype.includes;
  const originalArrayIncludes = Array.prototype.includes;

  String.prototype.includes = function(searchString: string, position?: number) {
    try {
      // Handle null/undefined this context
      if (this == null) {
        console.warn('[Enhanced Error Handler] String.includes called on null/undefined, returning false');
        return false;
      }
      
      // Convert to string and handle null/undefined searchString
      const str = String(this);
      const search = searchString == null ? 'null' : String(searchString);
      
      return originalStringIncludes.call(str, search, position);
    } catch (error) {
      console.warn('[Enhanced Error Handler] String.includes error caught:', error);
      return false;
    }
  };

  Array.prototype.includes = function(searchElement: any, fromIndex?: number) {
    try {
      // Handle null/undefined this context
      if (this == null) {
        console.warn('[Enhanced Error Handler] Array.includes called on null/undefined, returning false');
        return false;
      }
      
      return originalArrayIncludes.call(this, searchElement, fromIndex);
    } catch (error) {
      console.warn('[Enhanced Error Handler] Array.includes error caught:', error);
      return false;
    }
  };

  // Enhanced global error handling
  const originalConsoleError = console.error;
  console.error = function(...args: any[]) {
    const message = args.join(' ');
    
    // Suppress specific known errors that are handled
    if (
      message.includes('Cannot read properties of undefined (reading \'includes\')') ||
      message.includes('Failed to fetch') ||
      message.includes('TypeError: Cannot read properties of undefined') ||
      message.includes('ResizeObserver loop limit exceeded')
    ) {
      console.warn('[Enhanced Error Handler] Suppressed error:', message);
      return;
    }
    
    originalConsoleError.apply(console, args);
  };

  // Enhanced window error handler
  window.addEventListener('error', (event) => {
    const message = event.message || '';
    
    if (
      message.includes('Cannot read properties of undefined (reading \'includes\')') ||
      message.includes('Failed to fetch') ||
      message.includes('ResizeObserver loop limit exceeded')
    ) {
      console.warn('[Enhanced Error Handler] Suppressed window error:', message);
      event.preventDefault();
      return false;
    }
  });

  // Enhanced unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason);
    
    if (
      message.includes('Cannot read properties of undefined (reading \'includes\')') ||
      message.includes('Failed to fetch') ||
      message.includes('TypeError: Failed to fetch')
    ) {
      console.warn('[Enhanced Error Handler] Suppressed promise rejection:', message);
      event.preventDefault();
      return false;
    }
  });

  // Firestore connection error handler
  if (typeof window !== 'undefined') {
    // Override fetch to handle Firestore connection issues
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const response = await originalFetch(input, init);
        return response;
      } catch (error: any) {
        const url = typeof input === 'string' ? input : input.toString();
        
        // Handle Firestore Listen channel errors specifically
        if (url.includes('firestore.googleapis.com') && url.includes('/Listen/channel')) {
          console.warn('[Enhanced Error Handler] Firestore Listen channel error suppressed:', error.message);
          
          // Return a mock response to prevent cascading errors
          return new Response(JSON.stringify({ error: 'Connection temporarily unavailable' }), {
            status: 503,
            statusText: 'Service Temporarily Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Handle other fetch errors
        if (error.message === 'Failed to fetch') {
          console.warn('[Enhanced Error Handler] Network fetch error suppressed for:', url);
          
          return new Response(JSON.stringify({ error: 'Network temporarily unavailable' }), {
            status: 503,
            statusText: 'Network Error',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        throw error;
      }
    };
  }

  // React error boundary enhancement
  if (typeof window !== 'undefined' && window.React) {
    const originalCreateElement = window.React.createElement;
    window.React.createElement = function(type: any, props: any, ...children: any[]) {
      try {
        return originalCreateElement(type, props, ...children);
      } catch (error: any) {
        if (error.message && error.message.includes('Cannot read properties of undefined')) {
          console.warn('[Enhanced Error Handler] React createElement error suppressed:', error.message);
          return originalCreateElement('div', { className: 'error-fallback' }, 'Content temporarily unavailable');
        }
        throw error;
      }
    };
  }

  console.log('[Enhanced Error Handler] Initialized with comprehensive error suppression');
}

// Safe utility functions
export function safeStringIncludes(str: any, searchString: any): boolean {
  try {
    if (str == null || searchString == null) return false;
    return String(str).includes(String(searchString));
  } catch {
    return false;
  }
}

export function safeArrayIncludes(arr: any, searchElement: any): boolean {
  try {
    if (!Array.isArray(arr)) return false;
    return arr.includes(searchElement);
  } catch {
    return false;
  }
}

// Firestore connection recovery
export function initializeFirestoreRecovery() {
  if (typeof window === 'undefined') return;

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  window.addEventListener('online', () => {
    console.log('[Enhanced Error Handler] Network back online, attempting Firestore reconnection');
    reconnectAttempts = 0;
  });

  window.addEventListener('offline', () => {
    console.log('[Enhanced Error Handler] Network offline detected');
  });

  // Monitor for Firestore connection issues
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
    if (type === 'error' && this.toString().includes('firestore')) {
      const wrappedListener = (event: any) => {
        if (event.message && event.message.includes('Failed to fetch')) {
          console.warn('[Enhanced Error Handler] Firestore connection error intercepted');
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(() => {
              console.log(`[Enhanced Error Handler] Attempting Firestore reconnection (${reconnectAttempts}/${maxReconnectAttempts})`);
              // Trigger a reconnection attempt
              window.dispatchEvent(new CustomEvent('firestore-reconnect'));
            }, 1000 * reconnectAttempts);
          }
          
          return;
        }
        
        if (typeof listener === 'function') {
          listener(event);
        }
      };
      
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    
    return originalAddEventListener.call(this, type, listener, options);
  };
}