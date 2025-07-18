'use client';

import { useEffect } from 'react';

/**
 * Console Error Suppressor Component
 * Suppresses known non-critical console errors to improve developer experience
 * and reduce noise in production environments
 */
export function ConsoleErrorSuppressor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    // Track suppressed errors for debugging
    const suppressedErrors = new Map<string, number>();

    // List of error patterns to suppress
    const suppressPatterns = [
      // Stripe analytics errors (expected with ad blockers)
      /Error fetching https:\/\/r\.stripe\.com/,
      /Failed to fetch.*stripe\.com/,
      
      // PostHog analytics errors (expected with ad blockers)
      /POST https:\/\/us\.i\.posthog\.com.*net::ERR_BLOCKED_BY_CLIENT/,
      /Failed to fetch.*posthog\.com/,
      
      // Font loading errors (handled by font error handler)
      /Failed to decode downloaded font/,
      /Font.*failed to load/,
      
      // Source map errors (development artifacts, not critical)
      /Failed to load resource.*\.map/,
      /GET.*\.map.*404/,
      /GET.*\.map.*500/,
      
      // Next.js module resolution warnings (known issue)
      /Cannot find module '@next\/env'/,
      /Module not found.*@next\/env/,
      
      // Firebase connection warnings (handled by connection manager)
      /Firebase.*connection.*warning/i,
      /Firestore.*offline/i,
      
      // ResizeObserver errors (handled by resize observer error handler)
      /ResizeObserver loop limit exceeded/,
      
      // Common browser extension errors
      /Non-Error promise rejection captured/,
      /Script error/,
      
      // Ad blocker related errors
      /ERR_BLOCKED_BY_CLIENT/,
      /net::ERR_BLOCKED_BY_CLIENT/,
      
      // CORS errors for analytics services
      /Access to fetch.*blocked by CORS policy.*stripe/,
      /Access to fetch.*blocked by CORS policy.*posthog/,
    ];

    // Enhanced console.error override
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Check if this error should be suppressed
      const shouldSuppress = suppressPatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return message.includes(pattern);
        } else if (pattern instanceof RegExp) {
          return pattern.test(message);
        }
        return false;
      });

      if (shouldSuppress) {
        // Track suppressed errors
        const errorKey = message.substring(0, 100); // First 100 chars as key
        suppressedErrors.set(errorKey, (suppressedErrors.get(errorKey) || 0) + 1);
        
        // In development, show a minimal log
        if (process.env.NODE_ENV === 'development') {
          console.info(`[Suppressed Error] ${errorKey}...`);
        }
        
        return;
      }

      // Call original console.error for non-suppressed errors
      originalError.apply(console, args);
    };

    // Enhanced console.warn override
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      
      // Check if this warning should be suppressed
      const shouldSuppress = suppressPatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return message.includes(pattern);
        } else if (pattern instanceof RegExp) {
          return pattern.test(message);
        }
        return false;
      });

      if (shouldSuppress) {
        // Track suppressed warnings
        const warningKey = message.substring(0, 100);
        suppressedErrors.set(warningKey, (suppressedErrors.get(warningKey) || 0) + 1);
        
        // In development, show a minimal log
        if (process.env.NODE_ENV === 'development') {
          console.info(`[Suppressed Warning] ${warningKey}...`);
        }
        
        return;
      }

      // Call original console.warn for non-suppressed warnings
      originalWarn.apply(console, args);
    };

    // Add a method to check suppressed errors (for debugging)
    (window as any).__getSuppressedErrors = () => {
      return Object.fromEntries(suppressedErrors);
    };

    // Add a method to clear suppressed errors
    (window as any).__clearSuppressedErrors = () => {
      suppressedErrors.clear();
    };

    // Log initialization in development
    if (process.env.NODE_ENV === 'development') {
      console.info('[Console] Error suppressor initialized. Use __getSuppressedErrors() to view suppressed errors.');
    }

    // Cleanup function
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.log = originalLog;
      
      // Clean up global methods
      delete (window as any).__getSuppressedErrors;
      delete (window as any).__clearSuppressedErrors;
    };
  }, []);

  // This component doesn't render anything
  return null;
}

export default ConsoleErrorSuppressor;