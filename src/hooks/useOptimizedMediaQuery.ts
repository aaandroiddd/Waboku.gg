import { useState, useEffect, useCallback, useMemo } from 'react';

interface DeviceCapabilities {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLowEndDevice: boolean;
  prefersReducedMotion: boolean;
  supportsHover: boolean;
  devicePixelRatio: number;
  connectionType: string;
  hardwareConcurrency: number;
}

// Cache for device capabilities to avoid repeated calculations
let deviceCapabilitiesCache: DeviceCapabilities | null = null;

export function useOptimizedMediaQuery(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(() => {
    // Return cached capabilities if available
    if (deviceCapabilitiesCache) {
      return deviceCapabilitiesCache;
    }

    // Default values for SSR
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLowEndDevice: false,
      prefersReducedMotion: false,
      supportsHover: true,
      devicePixelRatio: 1,
      connectionType: 'unknown',
      hardwareConcurrency: 4
    };
  });

  const detectCapabilities = useCallback((): DeviceCapabilities => {
    if (typeof window === 'undefined') {
      return capabilities;
    }

    // Screen size detection
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    // Hardware detection
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Low-end device detection based on multiple factors
    const isLowEndDevice = (
      // Low core count
      hardwareConcurrency <= 4 ||
      // Small screen with high pixel density (resource intensive)
      (isMobile && devicePixelRatio > 2) ||
      // Very small screen
      width < 480 ||
      // Low memory (if available)
      ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4)
    );

    // Motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Hover support detection
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    // Connection type detection
    let connectionType = 'unknown';
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connectionType = connection?.effectiveType || connection?.type || 'unknown';
    }

    const newCapabilities: DeviceCapabilities = {
      isMobile,
      isTablet,
      isDesktop,
      isLowEndDevice,
      prefersReducedMotion,
      supportsHover,
      devicePixelRatio,
      connectionType,
      hardwareConcurrency
    };

    // Cache the capabilities
    deviceCapabilitiesCache = newCapabilities;
    
    return newCapabilities;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial detection
    const initialCapabilities = detectCapabilities();
    setCapabilities(initialCapabilities);

    // Throttled resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Clear cache on resize to force recalculation
        deviceCapabilitiesCache = null;
        const newCapabilities = detectCapabilities();
        setCapabilities(newCapabilities);
      }, 250);
    };

    // Media query listeners for motion preferences
    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setCapabilities(prev => ({
        ...prev,
        prefersReducedMotion: e.matches
      }));
    };

    // Hover support listener
    const hoverMediaQuery = window.matchMedia('(hover: hover)');
    const handleHoverChange = (e: MediaQueryListEvent) => {
      setCapabilities(prev => ({
        ...prev,
        supportsHover: e.matches
      }));
    };

    // Add event listeners
    window.addEventListener('resize', handleResize, { passive: true });
    motionMediaQuery.addEventListener('change', handleMotionChange);
    hoverMediaQuery.addEventListener('change', handleHoverChange);

    // Connection change listener
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const handleConnectionChange = () => {
        setCapabilities(prev => ({
          ...prev,
          connectionType: connection?.effectiveType || connection?.type || 'unknown'
        }));
      };
      connection?.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        motionMediaQuery.removeEventListener('change', handleMotionChange);
        hoverMediaQuery.removeEventListener('change', handleHoverChange);
        connection?.removeEventListener('change', handleConnectionChange);
        clearTimeout(resizeTimeout);
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      motionMediaQuery.removeEventListener('change', handleMotionChange);
      hoverMediaQuery.removeEventListener('change', handleHoverChange);
      clearTimeout(resizeTimeout);
    };
  }, [detectCapabilities]);

  return capabilities;
}

// Convenience hooks for specific capabilities
export function useIsMobile(): boolean {
  const { isMobile } = useOptimizedMediaQuery();
  return isMobile;
}

export function useIsLowEndDevice(): boolean {
  const { isLowEndDevice } = useOptimizedMediaQuery();
  return isLowEndDevice;
}

export function usePrefersReducedMotion(): boolean {
  const { prefersReducedMotion } = useOptimizedMediaQuery();
  return prefersReducedMotion;
}

export function useSupportsHover(): boolean {
  const { supportsHover } = useOptimizedMediaQuery();
  return supportsHover;
}

// Performance-aware animation configuration
export function useAnimationConfig() {
  const capabilities = useOptimizedMediaQuery();
  
  return useMemo(() => {
    const { isMobile, isLowEndDevice, prefersReducedMotion, connectionType } = capabilities;
    
    // Disable animations for reduced motion preference
    if (prefersReducedMotion) {
      return {
        shouldAnimate: false,
        duration: 0,
        stagger: 0,
        ease: 'linear'
      };
    }
    
    // Minimal animations for low-end devices or slow connections
    if (isLowEndDevice || connectionType === 'slow-2g' || connectionType === '2g') {
      return {
        shouldAnimate: true,
        duration: 0.15,
        stagger: 0,
        ease: 'easeOut'
      };
    }
    
    // Reduced animations for mobile
    if (isMobile) {
      return {
        shouldAnimate: true,
        duration: 0.25,
        stagger: 0.05,
        ease: 'easeOut'
      };
    }
    
    // Full animations for desktop
    return {
      shouldAnimate: true,
      duration: 0.5,
      stagger: 0.1,
      ease: [0.23, 1, 0.32, 1]
    };
  }, [capabilities]);
}

// Hook for performance-aware image loading
export function useImageLoadingStrategy() {
  const capabilities = useOptimizedMediaQuery();
  
  return useMemo(() => {
    const { isMobile, isLowEndDevice, connectionType, devicePixelRatio } = capabilities;
    
    // Determine image quality based on device capabilities
    let quality = 80;
    if (isLowEndDevice || connectionType === 'slow-2g' || connectionType === '2g') {
      quality = 60;
    } else if (isMobile) {
      quality = 70;
    }
    
    // Determine sizes attribute for responsive images
    const sizes = isMobile 
      ? "(max-width: 640px) 50vw, 33vw"
      : "(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw";
    
    // Determine loading strategy
    const loading = isLowEndDevice ? 'lazy' : 'lazy';
    const priority = false; // Generally avoid priority loading for performance
    
    return {
      quality,
      sizes,
      loading,
      priority,
      placeholder: isLowEndDevice ? 'empty' : 'blur'
    };
  }, [capabilities]);
}