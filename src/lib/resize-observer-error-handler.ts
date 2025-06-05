/**
 * ResizeObserver Error Handler
 * 
 * Handles the common "ResizeObserver loop completed with undelivered notifications" error
 * which is a benign error that occurs when ResizeObserver callbacks trigger layout changes
 * that cause infinite loops. This error doesn't affect functionality but can clutter logs.
 */

let isHandlerInstalled = false;

export function installResizeObserverErrorHandler() {
  if (isHandlerInstalled || typeof window === 'undefined') {
    return;
  }

  // Handle unhandled errors
  const originalErrorHandler = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    // Suppress ResizeObserver loop errors
    if (
      typeof message === 'string' && 
      message.includes('ResizeObserver loop completed with undelivered notifications')
    ) {
      console.debug('Suppressed ResizeObserver loop error (benign)');
      return true; // Prevent default error handling
    }
    
    // Call original handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler.call(this, message, source, lineno, colno, error);
    }
    
    return false;
  };

  // Handle unhandled promise rejections
  const originalRejectionHandler = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    const error = event.reason;
    
    // Suppress ResizeObserver loop errors
    if (
      error && 
      typeof error.message === 'string' && 
      error.message.includes('ResizeObserver loop completed with undelivered notifications')
    ) {
      console.debug('Suppressed ResizeObserver loop error in promise (benign)');
      event.preventDefault();
      return;
    }
    
    // Call original handler for other rejections
    if (originalRejectionHandler) {
      return originalRejectionHandler.call(this, event);
    }
  };

  // Override console.error to filter ResizeObserver errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    
    // Suppress ResizeObserver loop errors
    if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
      console.debug('Suppressed ResizeObserver loop error in console (benign)');
      return;
    }
    
    // Call original console.error for other errors
    originalConsoleError.apply(console, args);
  };

  isHandlerInstalled = true;
  console.debug('ResizeObserver error handler installed');
}

/**
 * Debounced ResizeObserver wrapper to prevent rapid firing
 */
export class DebouncedResizeObserver {
  private observer: ResizeObserver;
  private timeouts = new Map<Element, NodeJS.Timeout>();
  private delay: number;

  constructor(callback: ResizeObserverCallback, delay: number = 16) {
    this.delay = delay;
    
    this.observer = new ResizeObserver((entries, observer) => {
      entries.forEach(entry => {
        // Clear existing timeout for this element
        const existingTimeout = this.timeouts.get(entry.target);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set new debounced timeout
        const timeout = setTimeout(() => {
          try {
            callback([entry], observer);
          } catch (error) {
            console.error('Error in debounced ResizeObserver callback:', error);
          } finally {
            this.timeouts.delete(entry.target);
          }
        }, this.delay);

        this.timeouts.set(entry.target, timeout);
      });
    });
  }

  observe(target: Element, options?: ResizeObserverOptions) {
    this.observer.observe(target, options);
  }

  unobserve(target: Element) {
    // Clear any pending timeout for this element
    const timeout = this.timeouts.get(target);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(target);
    }
    
    this.observer.unobserve(target);
  }

  disconnect() {
    // Clear all pending timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    this.observer.disconnect();
  }
}