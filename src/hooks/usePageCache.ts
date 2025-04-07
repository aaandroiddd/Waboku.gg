import { useLoading } from '@/contexts/LoadingContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Hook to manage page caching and prefetching
 * @param pagesToPrefetch - Array of paths to prefetch
 */
export function usePageCache(pagesToPrefetch: string[] = []) {
  const { cachedPages } = useLoading();
  const router = useRouter();

  // Prefetch pages that might be visited next
  useEffect(() => {
    // Only prefetch in production and if there are pages to prefetch
    if (process.env.NODE_ENV === 'production' && pagesToPrefetch.length > 0) {
      pagesToPrefetch.forEach(path => {
        // Don't prefetch pages that are already cached
        if (!cachedPages.has(path)) {
          router.prefetch(path);
        }
      });
    }
  }, [pagesToPrefetch, router, cachedPages]);

  return {
    cachedPages,
    // Helper function to check if a page is cached
    isPageCached: (path: string) => cachedPages.has(path),
  };
}