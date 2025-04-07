import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/router';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  startLoading: () => void;
  stopLoading: () => void;
  cachedPages: Set<string>;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setLoading: () => {},
  startLoading: () => {},
  stopLoading: () => {},
  cachedPages: new Set(),
});

export const useLoading = () => useContext(LoadingContext);

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [cachedPages, setCachedPages] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Set up router event listeners for page transitions
  useEffect(() => {
    const handleStart = (url: string) => {
      // Don't show loading for hash changes on the same page
      if (url.includes('#') && router.asPath.split('#')[0] === url.split('#')[0]) {
        return;
      }
      
      // Don't show loading for cached pages
      const urlWithoutQuery = url.split('?')[0];
      if (cachedPages.has(urlWithoutQuery)) {
        return;
      }
      
      // Immediately set loading to true when navigation starts
      setIsLoading(true);
    };

    const handleComplete = (url: string) => {
      // Add the page to cached pages
      const urlWithoutQuery = url.split('?')[0];
      setCachedPages(prev => new Set([...prev, urlWithoutQuery]));
      
      // Reduce the delay before hiding the loading screen
      setTimeout(() => setIsLoading(false), 100);
    };

    const handleError = () => {
      setTimeout(() => setIsLoading(false), 100);
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
    };
  }, [router, cachedPages]);

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  return (
    <LoadingContext.Provider value={{ 
      isLoading, 
      setLoading: setIsLoading, 
      startLoading, 
      stopLoading,
      cachedPages
    }}>
      {children}
    </LoadingContext.Provider>
  );
}