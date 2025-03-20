import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setLoading: () => {},
  startLoading: () => {},
  stopLoading: () => {},
});

export const useLoading = () => useContext(LoadingContext);

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Set up router event listeners for page transitions
  useEffect(() => {
    const handleStart = (url: string) => {
      // Don't show loading for hash changes on the same page
      if (url.includes('#') && router.asPath.split('#')[0] === url.split('#')[0]) {
        return;
      }
      // Immediately set loading to true when navigation starts
      setIsLoading(true);
    };

    const handleComplete = () => {
      // Keep loading true for a moment to allow content to render
      // This prevents flashing of previous page content
      setTimeout(() => setIsLoading(false), 400);
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading: setIsLoading, startLoading, stopLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}