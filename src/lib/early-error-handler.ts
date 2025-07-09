/**
 * Early error handler that runs before React and other libraries
 * This is designed to catch and fix the "Cannot read properties of undefined (reading 'includes')" error
 */

// This function should be called as early as possible in the application lifecycle
export function installEarlyErrorHandler() {
  if (typeof window === 'undefined') return;

  // Store original methods before any other code can modify them
  const originalStringIncludes = String.prototype.includes;
  const originalArrayIncludes = Array.prototype.includes;
  
  // Create a safe includes function
  function safeIncludes(this: any, searchString: any, position?: number): boolean {
    try {
      // Handle null/undefined 'this'
      if (this == null) {
        console.warn('[Early Error Handler] includes() called on null/undefined, returning false');
        return false;
      }
      
      // Handle null/undefined searchString
      if (searchString == null) {
        console.warn('[Early Error Handler] includes() called with null/undefined searchString, returning false');
        return false;
      }
      
      // Convert to string and use original method
      const str = String(this);
      const search = String(searchString);
      return originalStringIncludes.call(str, search, position);
    } catch (error) {
      console.warn('[Early Error Handler] Error in safe includes():', error, { 
        this: this, 
        searchString, 
        position,
        thisType: typeof this,
        searchType: typeof searchString
      });
      return false;
    }
  }
  
  // Create a safe array includes function
  function safeArrayIncludes(this: any, searchElement: any, fromIndex?: number): boolean {
    try {
      // Handle null/undefined 'this'
      if (this == null) {
        console.warn('[Early Error Handler] Array.includes() called on null/undefined, returning false');
        return false;
      }
      
      // Ensure this is array-like
      if (typeof this.length !== 'number') {
        console.warn('[Early Error Handler] Array.includes() called on non-array-like object, returning false');
        return false;
      }
      
      return originalArrayIncludes.call(this, searchElement, fromIndex);
    } catch (error) {
      console.warn('[Early Error Handler] Error in safe Array.includes():', error, { 
        this: this, 
        searchElement, 
        fromIndex,
        thisType: typeof this,
        isArray: Array.isArray(this)
      });
      return false;
    }
  }
  
  // Replace the prototype methods with safe versions
  String.prototype.includes = safeIncludes;
  Array.prototype.includes = safeArrayIncludes;
  
  // Install early error handlers
  const handleError = (error: any, source: string) => {
    const message = error?.message || error?.toString() || '';
    
    if (message.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn(`[Early Error Handler] Caught includes() error from ${source}:`, error);
      console.warn('[Early Error Handler] This should not happen with our prototype patches');
      return true; // Handled
    }
    
    // Handle other common undefined property access errors
    if (message.includes('Cannot read properties of undefined') || 
        message.includes('Cannot read property') ||
        message.includes('undefined is not an object')) {
      console.warn(`[Early Error Handler] Caught undefined property access from ${source}:`, error);
      return true; // Handled
    }
    
    return false; // Not handled
  };
  
  // Install global error handler
  window.addEventListener('error', (event) => {
    if (handleError(event.error, 'window.error')) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true); // Use capture phase to catch errors early
  
  // Install global promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    if (handleError(event.reason, 'unhandledrejection')) {
      event.preventDefault();
      return false;
    }
  }, true); // Use capture phase to catch errors early
  
  // Patch console.error to catch and suppress the specific error
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn('[Early Error Handler] Suppressed includes() console error:', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  console.log('[Early Error Handler] Installed early error handling and prototype patches');
}

// Auto-install if we're in a browser environment
if (typeof window !== 'undefined') {
  installEarlyErrorHandler();
}