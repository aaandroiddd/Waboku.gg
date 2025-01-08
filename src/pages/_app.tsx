import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { RouteGuard } from '@/components/RouteGuard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const protectedPaths = [
  '/dashboard',
  '/profile',
  '/listings/create',
  '/messages',
  '/settings',
];

export default function App({ Component, pageProps, router }: AppProps) {
  const [isLoading, setIsLoading] = useState(false);
  const requireAuth = protectedPaths.some(path => 
    router.pathname.startsWith(path)
  );

  useEffect(() => {
    const handleStart = () => setIsLoading(true);
    const handleComplete = () => setIsLoading(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <RouteGuard requireAuth={requireAuth}>
          <LoadingScreen isLoading={isLoading} />
          <AnimatePresence mode="wait">
            <PageTransition key={router.pathname}>
              <Component {...pageProps} />
            </PageTransition>
          </AnimatePresence>
          <Toaster />
        </RouteGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}