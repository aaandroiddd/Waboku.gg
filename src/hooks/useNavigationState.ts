import { useState, useEffect } from 'react';

interface NavigationState {
  isNavigating: boolean;
  isBackForward: boolean;
  previousPath: string | null;
  currentPath: string;
}

/**
 * Hook to track navigation state and detect when users are navigating between pages
 */
export function useNavigationState() {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    isBackForward: false,
    previousPath: null,
    currentPath: typeof window !== 'undefined' ? window.location.pathname : ''
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isNavigating = false;
    let navigationTimeout: NodeJS.Timeout;

    // Detect navigation type on page load
    const detectNavigationType = () => {
      if (window.performance && window.performance.navigation) {
        const navigationType = window.performance.navigation.type;
        const isBackForward = navigationType === window.performance.navigation.TYPE_BACK_FORWARD;
        
        setNavigationState(prev => ({
          ...prev,
          isBackForward,
          currentPath: window.location.pathname
        }));
      }
    };

    // Track route changes for SPA navigation
    const handleRouteChange = () => {
      const newPath = window.location.pathname;
      
      setNavigationState(prev => {
        // Only update if path actually changed
        if (prev.currentPath !== newPath) {
          return {
            isNavigating: true,
            isBackForward: false, // SPA navigation is not back/forward
            previousPath: prev.currentPath,
            currentPath: newPath
          };
        }
        return prev;
      });

      // Set navigation flag
      isNavigating = true;
      
      // Clear any existing timeout
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
      
      // Reset navigation flag after a short delay
      navigationTimeout = setTimeout(() => {
        isNavigating = false;
        setNavigationState(prev => ({
          ...prev,
          isNavigating: false
        }));
      }, 1000); // 1 second should be enough for most navigation to complete
    };

    // Initial detection
    detectNavigationType();

    // Listen for popstate events (back/forward navigation)
    const handlePopState = () => {
      setNavigationState(prev => ({
        isNavigating: true,
        isBackForward: true,
        previousPath: prev.currentPath,
        currentPath: window.location.pathname
      }));
      
      // Reset after delay
      setTimeout(() => {
        setNavigationState(prev => ({
          ...prev,
          isNavigating: false
        }));
      }, 1000);
    };

    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      handleRouteChange();
    };

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      handleRouteChange();
    };

    // Listen for popstate events
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, []);

  return navigationState;
}

/**
 * Hook to detect if user is returning to dashboard from navigation
 */
export function useDashboardNavigationDetection() {
  const navigationState = useNavigationState();
  
  const isDashboardReturn = navigationState.currentPath === '/dashboard' && 
    navigationState.previousPath && 
    navigationState.previousPath !== '/dashboard' &&
    (navigationState.isBackForward || navigationState.isNavigating);

  const isFromDashboardSubpage = navigationState.currentPath === '/dashboard' &&
    navigationState.previousPath?.startsWith('/dashboard/');

  return {
    isDashboardReturn,
    isFromDashboardSubpage,
    isNavigating: navigationState.isNavigating,
    isBackForward: navigationState.isBackForward,
    previousPath: navigationState.previousPath
  };
}