import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

// Global cache to prevent multiple observers for the same query
const mediaQueryCache = new Map<string, boolean>();
const mediaQueryListeners = new Map<string, Set<(matches: boolean) => void>>();

export function useOptimizedMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    // Return cached value if available, otherwise default to false for SSR
    return mediaQueryCache.get(query) ?? false;
  });
  
  const callbackRef = useRef<(matches: boolean) => void>();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Create callback function
    callbackRef.current = (newMatches: boolean) => {
      setMatches(newMatches);
    };

    // Get or create listeners set for this query
    let listeners = mediaQueryListeners.get(query);
    if (!listeners) {
      listeners = new Set();
      mediaQueryListeners.set(query, listeners);
      
      // Create media query list and set up global listener
      const media = window.matchMedia(query);
      const globalListener = (e: MediaQueryListEvent) => {
        const newMatches = e.matches;
        mediaQueryCache.set(query, newMatches);
        
        // Notify all listeners for this query
        const currentListeners = mediaQueryListeners.get(query);
        if (currentListeners) {
          currentListeners.forEach(callback => {
            try {
              callback(newMatches);
            } catch (error) {
              console.error('Error in media query callback:', error);
            }
          });
        }
      };
      
      // Set initial value
      const initialMatches = media.matches;
      mediaQueryCache.set(query, initialMatches);
      
      // Add global listener
      media.addEventListener('change', globalListener);
      
      // Store cleanup function
      (listeners as any)._cleanup = () => {
        media.removeEventListener('change', globalListener);
        mediaQueryCache.delete(query);
        mediaQueryListeners.delete(query);
      };
    }

    // Add this component's callback to the listeners
    if (callbackRef.current) {
      listeners.add(callbackRef.current);
    }

    // Set initial value from cache
    const cachedValue = mediaQueryCache.get(query);
    if (cachedValue !== undefined) {
      setMatches(cachedValue);
    }

    // Cleanup function
    return () => {
      if (callbackRef.current) {
        const currentListeners = mediaQueryListeners.get(query);
        if (currentListeners) {
          currentListeners.delete(callbackRef.current);
          
          // If no more listeners, cleanup the global listener
          if (currentListeners.size === 0) {
            const cleanup = (currentListeners as any)._cleanup;
            if (cleanup) {
              cleanup();
            }
          }
        }
      }
    };
  }, [query]);

  return matches;
}

// Animation configuration hook
export function useAnimationConfig() {
  const isMobile = useOptimizedMediaQuery("(max-width: 768px)");
  const prefersReducedMotion = useReducedMotion();
  
  // Determine if animations should be enabled
  const shouldAnimate = !isMobile && !prefersReducedMotion;
  
  // Configure animation parameters based on device capabilities
  const animationConfig = {
    shouldAnimate,
    duration: shouldAnimate ? 0.6 : 0.1,
    stagger: shouldAnimate ? 0.1 : 0,
    ease: shouldAnimate ? "easeOut" : "linear",
    // Additional performance optimizations
    reducedMotion: prefersReducedMotion,
    isMobile,
    // GPU acceleration hints
    willChange: shouldAnimate ? "transform, opacity" : "auto",
    // Layout optimization
    layoutOptimization: !shouldAnimate
  };
  
  return animationConfig;
}