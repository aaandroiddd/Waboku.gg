/**
 * Performance Optimizer - Comprehensive performance optimization system
 * This utility provides various performance optimization strategies for the application
 */

interface PerformanceMetrics {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface ComponentPerformanceData {
  componentName: string;
  renderTime: number;
  renderCount: number;
  lastRender: number;
  averageRenderTime: number;
}

class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private componentMetrics = new Map<string, ComponentPerformanceData>();
  private performanceObserver?: PerformanceObserver;
  private memoryMonitorInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  private constructor() {
    this.initializePerformanceMonitoring();
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;

    try {
      // Monitor Core Web Vitals
      if ('PerformanceObserver' in window) {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handlePerformanceEntry(entry);
          }
        });

        // Observe different types of performance entries
        try {
          this.performanceObserver.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
        } catch (e) {
          // Fallback for browsers that don't support all entry types
          try {
            this.performanceObserver.observe({ entryTypes: ['navigation', 'paint'] });
          } catch (fallbackError) {
            console.warn('Performance monitoring not fully supported');
          }
        }
      }

      // Monitor memory usage periodically
      this.startMemoryMonitoring();

      // Monitor long tasks
      this.monitorLongTasks();

      this.isMonitoring = true;
    } catch (error) {
      console.error('Error initializing performance monitoring:', error);
    }
  }

  /**
   * Handle performance entries
   */
  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'largest-contentful-paint':
        console.log('LCP:', entry.startTime);
        break;
      case 'first-input':
        console.log('FID:', (entry as any).processingStart - entry.startTime);
        break;
      case 'layout-shift':
        if (!(entry as any).hadRecentInput) {
          console.log('CLS:', (entry as any).value);
        }
        break;
      case 'navigation':
        this.logNavigationTiming(entry as PerformanceNavigationTiming);
        break;
    }
  }

  /**
   * Log navigation timing
   */
  private logNavigationTiming(entry: PerformanceNavigationTiming): void {
    const metrics = {
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      tcp: entry.connectEnd - entry.connectStart,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      dom: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      load: entry.loadEventEnd - entry.loadEventStart,
      total: entry.loadEventEnd - entry.navigationStart
    };

    console.log('Navigation Timing:', metrics);
  }

  /**
   * Monitor long tasks that block the main thread
   */
  private monitorLongTasks(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('Long task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
        }
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('Long task monitoring not supported');
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (typeof window === 'undefined') return;

    this.memoryMonitorInterval = setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        const usage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usage > 80) {
          console.warn('High memory usage detected:', {
            usage: `${usage.toFixed(2)}%`,
            used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
          });
          
          // Suggest garbage collection if usage is very high
          if (usage > 90) {
            this.suggestGarbageCollection();
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Suggest garbage collection
   */
  private suggestGarbageCollection(): void {
    console.warn('Suggesting garbage collection due to high memory usage');
    
    // Clear unnecessary caches
    this.clearUnnecessaryCaches();
    
    // Force garbage collection if available (development only)
    if (process.env.NODE_ENV === 'development' && (window as any).gc) {
      (window as any).gc();
    }
  }

  /**
   * Clear unnecessary caches
   */
  private clearUnnecessaryCaches(): void {
    if (typeof window === 'undefined') return;

    try {
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutes

      // Clear old cache entries
      Object.keys(localStorage).forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && (now - data.timestamp) > maxAge) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Clear session storage of old entries
      Object.keys(sessionStorage).forEach(key => {
        try {
          const item = sessionStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            if (data.timestamp && (now - data.timestamp) > maxAge) {
              sessionStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      console.log('Cleared unnecessary caches');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Track component render performance
   */
  trackComponentRender(componentName: string, renderTime: number): void {
    const existing = this.componentMetrics.get(componentName);
    
    if (existing) {
      existing.renderCount++;
      existing.lastRender = Date.now();
      existing.averageRenderTime = (existing.averageRenderTime * (existing.renderCount - 1) + renderTime) / existing.renderCount;
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderTime,
        renderCount: 1,
        lastRender: Date.now(),
        averageRenderTime: renderTime
      });
    }

    // Warn about slow components
    if (renderTime > 16) { // More than one frame at 60fps
      console.warn(`Slow component render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Get component performance metrics
   */
  getComponentMetrics(): ComponentPerformanceData[] {
    return Array.from(this.componentMetrics.values());
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    if (typeof window === 'undefined' || !window.performance) return null;

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      const metrics: PerformanceMetrics = {
        navigationStart: navigation.navigationStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart
      };

      // Add paint metrics if available
      paint.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          metrics.firstContentfulPaint = entry.startTime;
        }
      });

      // Add memory metrics if available
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        metrics.memoryUsage = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      }

      return metrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return null;
    }
  }

  /**
   * Optimize images by preloading critical ones
   */
  preloadCriticalImages(imageUrls: string[]): void {
    if (typeof window === 'undefined') return;

    imageUrls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  /**
   * Lazy load images with intersection observer
   */
  setupLazyLoading(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  /**
   * Debounce function for performance optimization
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  }

  /**
   * Throttle function for performance optimization
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Optimize bundle by code splitting recommendations
   */
  analyzeBundleSize(): void {
    if (typeof window === 'undefined') return;

    // Analyze loaded scripts
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const totalSize = scripts.reduce((size, script) => {
      const src = (script as HTMLScriptElement).src;
      // This is a rough estimation - in production you'd want actual bundle analysis
      return size + src.length;
    }, 0);

    console.log('Bundle analysis:', {
      scriptCount: scripts.length,
      estimatedSize: `${(totalSize / 1024).toFixed(2)}KB`,
      recommendations: totalSize > 500000 ? ['Consider code splitting', 'Lazy load non-critical components'] : ['Bundle size looks good']
    });
  }

  /**
   * Optimize database queries by batching
   */
  batchDatabaseOperations<T>(
    operations: (() => Promise<T>)[],
    batchSize = 5
  ): Promise<T[]> {
    const batches: (() => Promise<T>)[][] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    return batches.reduce(async (previousBatch, currentBatch) => {
      const results = await previousBatch;
      const batchResults = await Promise.all(currentBatch.map(op => op()));
      return [...results, ...batchResults];
    }, Promise.resolve([] as T[]));
  }

  /**
   * Clean up performance monitoring
   */
  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    this.isMonitoring = false;
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getCurrentMetrics();
    
    if (!metrics) return recommendations;

    // Check load times
    if (metrics.loadComplete > 3000) {
      recommendations.push('Page load time is slow (>3s). Consider optimizing images and reducing bundle size.');
    }

    if (metrics.domContentLoaded > 1500) {
      recommendations.push('DOM content loaded time is slow (>1.5s). Consider reducing JavaScript execution time.');
    }

    // Check memory usage
    if (metrics.memoryUsage) {
      const usage = (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
      if (usage > 70) {
        recommendations.push('High memory usage detected. Consider implementing better cache management.');
      }
    }

    // Check component performance
    const slowComponents = this.getComponentMetrics().filter(c => c.averageRenderTime > 16);
    if (slowComponents.length > 0) {
      recommendations.push(`Slow components detected: ${slowComponents.map(c => c.componentName).join(', ')}. Consider optimization.`);
    }

    return recommendations;
  }
}

// Export singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance();

// Utility functions for easy access
export const trackComponentRender = (componentName: string, renderTime: number) => 
  performanceOptimizer.trackComponentRender(componentName, renderTime);

export const getCurrentMetrics = () => performanceOptimizer.getCurrentMetrics();
export const getComponentMetrics = () => performanceOptimizer.getComponentMetrics();
export const preloadCriticalImages = (imageUrls: string[]) => performanceOptimizer.preloadCriticalImages(imageUrls);
export const setupLazyLoading = () => performanceOptimizer.setupLazyLoading();
export const debounce = performanceOptimizer.debounce.bind(performanceOptimizer);
export const throttle = performanceOptimizer.throttle.bind(performanceOptimizer);
export const batchDatabaseOperations = performanceOptimizer.batchDatabaseOperations.bind(performanceOptimizer);
export const getPerformanceRecommendations = () => performanceOptimizer.getPerformanceRecommendations();