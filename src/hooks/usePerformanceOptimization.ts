import { useEffect, useRef, useCallback, useState } from 'react';
import { performanceOptimizer, trackComponentRender, debounce, throttle } from '@/lib/performance-optimizer';

interface UsePerformanceOptimizationOptions {
  componentName?: string;
  trackRenders?: boolean;
  enableLazyLoading?: boolean;
  preloadImages?: string[];
  debounceDelay?: number;
  throttleDelay?: number;
}

interface PerformanceHookReturn {
  renderTime: number;
  renderCount: number;
  isSlowRender: boolean;
  debounce: <T extends (...args: any[]) => any>(func: T, delay?: number) => (...args: Parameters<T>) => void;
  throttle: <T extends (...args: any[]) => any>(func: T, delay?: number) => (...args: Parameters<T>) => void;
  measureRender: (callback: () => void) => void;
  preloadImages: (urls: string[]) => void;
  getMetrics: () => any;
}

export function usePerformanceOptimization(
  options: UsePerformanceOptimizationOptions = {}
): PerformanceHookReturn {
  const {
    componentName = 'UnknownComponent',
    trackRenders = true,
    enableLazyLoading = false,
    preloadImages = [],
    debounceDelay = 300,
    throttleDelay = 100
  } = options;

  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const [renderTime, setRenderTime] = useState<number>(0);
  const [isSlowRender, setIsSlowRender] = useState<boolean>(false);

  // Track component mount and unmount
  useEffect(() => {
    if (trackRenders) {
      renderStartTime.current = performance.now();
    }

    // Setup lazy loading if enabled
    if (enableLazyLoading) {
      performanceOptimizer.setupLazyLoading();
    }

    // Preload critical images
    if (preloadImages.length > 0) {
      performanceOptimizer.preloadCriticalImages(preloadImages);
    }

    return () => {
      // Cleanup if needed
    };
  }, [trackRenders, enableLazyLoading, preloadImages]);

  // Track render completion
  useEffect(() => {
    if (trackRenders && renderStartTime.current > 0) {
      const endTime = performance.now();
      const duration = endTime - renderStartTime.current;
      
      renderCount.current += 1;
      setRenderTime(duration);
      setIsSlowRender(duration > 16); // More than one frame at 60fps
      
      // Track with performance optimizer
      trackComponentRender(componentName, duration);
      
      // Reset for next render
      renderStartTime.current = 0;
    }
  });

  // Measure specific render operations
  const measureRender = useCallback((callback: () => void) => {
    const start = performance.now();
    callback();
    const end = performance.now();
    const duration = end - start;
    
    trackComponentRender(`${componentName}-manual`, duration);
    
    if (duration > 16) {
      console.warn(`Slow operation in ${componentName}: ${duration.toFixed(2)}ms`);
    }
  }, [componentName]);

  // Debounced function factory
  const debouncedFunction = useCallback(
    <T extends (...args: any[]) => any>(func: T, delay = debounceDelay) => {
      return debounce(func, delay);
    },
    [debounceDelay]
  );

  // Throttled function factory
  const throttledFunction = useCallback(
    <T extends (...args: any[]) => any>(func: T, delay = throttleDelay) => {
      return throttle(func, delay);
    },
    [throttleDelay]
  );

  // Preload images function
  const preloadImagesFunction = useCallback((urls: string[]) => {
    performanceOptimizer.preloadCriticalImages(urls);
  }, []);

  // Get performance metrics
  const getMetrics = useCallback(() => {
    return {
      current: performanceOptimizer.getCurrentMetrics(),
      components: performanceOptimizer.getComponentMetrics(),
      recommendations: performanceOptimizer.getPerformanceRecommendations()
    };
  }, []);

  return {
    renderTime,
    renderCount: renderCount.current,
    isSlowRender,
    debounce: debouncedFunction,
    throttle: throttledFunction,
    measureRender,
    preloadImages: preloadImagesFunction,
    getMetrics
  };
}

// Hook for optimizing search functionality
export function useOptimizedSearch<T>(
  searchFunction: (query: string) => Promise<T[]>,
  debounceDelay = 300
) {
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const searchResults = await searchFunction(query);
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceDelay),
    [searchFunction, debounceDelay]
  );

  const search = useCallback((query: string) => {
    debouncedSearch(query);
  }, [debouncedSearch]);

  return {
    results,
    isLoading,
    error,
    search
  };
}

// Hook for optimizing scroll events
export function useOptimizedScroll(
  callback: (scrollY: number) => void,
  throttleDelay = 16 // 60fps
) {
  const throttledCallback = useCallback(
    throttle((scrollY: number) => callback(scrollY), throttleDelay),
    [callback, throttleDelay]
  );

  useEffect(() => {
    const handleScroll = () => {
      throttledCallback(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [throttledCallback]);
}

// Hook for optimizing resize events
export function useOptimizedResize(
  callback: (width: number, height: number) => void,
  debounceDelay = 250
) {
  const debouncedCallback = useCallback(
    debounce((width: number, height: number) => callback(width, height), debounceDelay),
    [callback, debounceDelay]
  );

  useEffect(() => {
    const handleResize = () => {
      debouncedCallback(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    
    // Call once on mount
    debouncedCallback(window.innerWidth, window.innerHeight);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [debouncedCallback]);
}

// Hook for virtual scrolling optimization
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );
  
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  const handleScroll = useCallback(
    throttle((event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    }, 16),
    []
  );
  
  return {
    visibleItems,
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    handleScroll
  };
}

// Hook for intersection observer optimization
export function useIntersectionObserver(
  callback: (isIntersecting: boolean) => void,
  options: IntersectionObserverInit = {}
) {
  const targetRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        callback(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );
    
    observer.observe(target);
    
    return () => {
      observer.unobserve(target);
    };
  }, [callback, options]);
  
  return targetRef;
}