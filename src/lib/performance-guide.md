# Performance Optimization Guide

This guide outlines the comprehensive performance optimization system implemented in the application.

## Overview

The application now includes a multi-layered performance optimization system that addresses:

1. **Component Performance Monitoring**
2. **Memory Management**
3. **Database Query Optimization**
4. **Image Loading Optimization**
5. **Search Performance**
6. **Caching Strategies**
7. **Bundle Size Optimization**

## Components

### 1. Performance Optimizer (`src/lib/performance-optimizer.ts`)

The core performance monitoring and optimization system that provides:

- **Core Web Vitals Monitoring**: Tracks LCP, FID, CLS automatically
- **Memory Usage Monitoring**: Monitors JavaScript heap usage and suggests cleanup
- **Component Render Tracking**: Identifies slow-rendering components
- **Long Task Detection**: Warns about tasks that block the main thread
- **Automatic Cache Cleanup**: Removes stale cache entries when memory usage is high

### 2. Performance Hooks (`src/hooks/usePerformanceOptimization.ts`)

React hooks for easy integration of performance optimizations:

- **`usePerformanceOptimization`**: Main hook for component performance tracking
- **`useOptimizedSearch`**: Debounced search with automatic loading states
- **`useOptimizedScroll`**: Throttled scroll event handling
- **`useOptimizedResize`**: Debounced resize event handling
- **`useVirtualScrolling`**: Virtual scrolling for large lists
- **`useIntersectionObserver`**: Optimized intersection observer for lazy loading

### 3. Performance Monitor Component (`src/components/PerformanceMonitor.tsx`)

A development tool that provides real-time performance insights:

- **Performance Score**: Overall application performance rating
- **Load Time Metrics**: DOM ready, load complete, FCP times
- **Memory Usage**: Real-time memory consumption tracking
- **Component Performance**: List of slowest components
- **Recommendations**: Actionable performance improvement suggestions

### 4. Optimized Components

#### Performance Optimized Listing Card (`src/components/PerformanceOptimizedListingCard.tsx`)

Features:
- **Lazy Loading**: Only renders when in viewport
- **Image Optimization**: Progressive loading with placeholders
- **Memoized Calculations**: Expensive operations cached
- **Debounced Interactions**: Prevents rapid-fire events
- **Intersection Observer**: Efficient viewport detection

#### Optimized Search Bar (`src/components/OptimizedSearchBar.tsx`)

Features:
- **Debounced Search**: Reduces API calls
- **Local Storage Caching**: Recent searches cached
- **Performance Tracking**: Render time monitoring
- **Optimized Suggestions**: Efficient suggestion rendering

## Usage Examples

### Basic Component Performance Tracking

```tsx
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

function MyComponent() {
  const { measureRender, isSlowRender } = usePerformanceOptimization({
    componentName: 'MyComponent',
    trackRenders: true
  });

  const handleExpensiveOperation = () => {
    measureRender(() => {
      // Your expensive operation here
    });
  };

  return (
    <div>
      {isSlowRender && <div>⚠️ Slow render detected</div>}
      {/* Your component content */}
    </div>
  );
}
```

### Optimized Search Implementation

```tsx
import { useOptimizedSearch } from '@/hooks/usePerformanceOptimization';

function SearchComponent() {
  const searchFunction = async (query: string) => {
    // Your search API call
    return await searchAPI(query);
  };

  const { results, isLoading, search } = useOptimizedSearch(searchFunction, 300);

  return (
    <div>
      <input onChange={(e) => search(e.target.value)} />
      {isLoading && <div>Searching...</div>}
      {results.map(result => <div key={result.id}>{result.title}</div>)}
    </div>
  );
}
```

### Virtual Scrolling for Large Lists

```tsx
import { useVirtualScrolling } from '@/hooks/usePerformanceOptimization';

function LargeList({ items }: { items: any[] }) {
  const {
    visibleItems,
    offsetY,
    totalHeight,
    handleScroll
  } = useVirtualScrolling(items, 100, 600); // 100px item height, 600px container

  return (
    <div 
      style={{ height: 600, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={item.id} style={{ height: 100 }}>
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Lazy Loading with Intersection Observer

```tsx
import { useIntersectionObserver } from '@/hooks/usePerformanceOptimization';

function LazyComponent() {
  const [isVisible, setIsVisible] = useState(false);
  
  const ref = useIntersectionObserver(
    (isIntersecting) => setIsVisible(isIntersecting),
    { threshold: 0.1, rootMargin: '100px' }
  );

  return (
    <div ref={ref}>
      {isVisible ? (
        <ExpensiveComponent />
      ) : (
        <div>Loading placeholder...</div>
      )}
    </div>
  );
}
```

## Performance Monitoring

### Development Mode

The Performance Monitor is automatically available in development mode. Click the activity icon in the bottom-right corner to view:

- Real-time performance metrics
- Component render times
- Memory usage
- Performance recommendations

### Production Monitoring

For production monitoring, you can enable the Performance Monitor by setting:

```tsx
<PerformanceMonitor showInProduction={true} />
```

### Getting Performance Metrics Programmatically

```tsx
import { getCurrentMetrics, getPerformanceRecommendations } from '@/lib/performance-optimizer';

// Get current performance metrics
const metrics = getCurrentMetrics();
console.log('Load time:', metrics?.loadComplete);
console.log('Memory usage:', metrics?.memoryUsage);

// Get performance recommendations
const recommendations = getPerformanceRecommendations();
recommendations.forEach(rec => console.log('Recommendation:', rec));
```

## Best Practices

### 1. Component Optimization

- Use `React.memo()` for components that receive stable props
- Implement `useMemo()` and `useCallback()` for expensive calculations
- Track component performance with `usePerformanceOptimization`
- Use lazy loading for components not immediately visible

### 2. Image Optimization

- Use Next.js `Image` component with proper `sizes` attribute
- Implement lazy loading for images below the fold
- Use appropriate image formats (WebP, AVIF)
- Preload critical images

### 3. Search Optimization

- Implement debounced search to reduce API calls
- Cache search results locally
- Use virtual scrolling for large result sets
- Implement search suggestions with caching

### 4. Memory Management

- Monitor memory usage in development
- Clear unnecessary caches periodically
- Avoid memory leaks in event listeners and timers
- Use weak references where appropriate

### 5. Database Optimization

- Batch database operations when possible
- Use pagination for large datasets
- Implement proper indexing
- Cache frequently accessed data

## Configuration

### Next.js Configuration

The application includes optimized Next.js configuration in `next.config.mjs`:

- Image optimization with multiple formats
- Compression enabled
- SWC minification
- Optimized caching headers
- Bundle size optimization

### Performance Budgets

Recommended performance budgets:

- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Component Render Time**: < 16ms (60fps)
- **Memory Usage**: < 70% of available heap

## Troubleshooting

### Common Performance Issues

1. **Slow Component Renders**
   - Check the Performance Monitor for slow components
   - Use `React.memo()` and `useMemo()` appropriately
   - Avoid inline object/function creation in render

2. **High Memory Usage**
   - Monitor memory in Performance Monitor
   - Clear unnecessary caches
   - Check for memory leaks in event listeners

3. **Slow Search**
   - Implement debouncing
   - Use local caching
   - Optimize search API endpoints

4. **Large Bundle Size**
   - Use dynamic imports for large components
   - Implement code splitting
   - Remove unused dependencies

### Performance Debugging

1. Enable Performance Monitor in development
2. Check browser DevTools Performance tab
3. Use React DevTools Profiler
4. Monitor Core Web Vitals in production

## Monitoring in Production

For production monitoring, consider integrating with:

- Google Analytics 4 (Core Web Vitals)
- Sentry (Performance monitoring)
- New Relic (Application performance)
- Custom analytics for business metrics

The performance optimization system provides a solid foundation for maintaining excellent application performance as the codebase grows.