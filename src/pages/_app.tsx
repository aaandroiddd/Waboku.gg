import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { Toaster } from '@/components/ui/toaster';
import { RouteGuard } from '@/components/RouteGuard';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useState, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { AnimatePresence } from 'framer-motion';

const LoadingScreen = dynamic(() => import('@/components/LoadingScreen').then(mod => ({ default: mod.LoadingScreen })), {
  ssr: false
});

const PageTransition = dynamic(() => import('@/components/PageTransition').then(mod => ({ default: mod.PageTransition })), {
  ssr: false
});

const protectedPaths = [
  '/dashboard',
  '/profile',
  '/listings/create',
  '/messages',
  '/settings',
];

// Memoize the main content to prevent unnecessary re-renders
const MainContent = memo(({ Component, pageProps, pathname, isLoading }: {
  Component: any;
  pageProps: any;
  pathname: string;
  isLoading: boolean;
}) => {
  const auth = useAuth();
  const account = useAccount();

  // Show loading screen while auth or account is initializing
  if (auth.isLoading || account.isLoading) {
    return <LoadingScreen isLoading={true} />;
  }

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      <AnimatePresence mode="wait">
        <PageTransition key={pathname}>
          <Component {...pageProps} />
        </PageTransition>
      </AnimatePresence>
      <Toaster />
    </>
  );
});

MainContent.displayName = 'MainContent';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
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
        <AccountProvider>
          <RouteGuard requireAuth={requireAuth}>
            <MainContent 
              Component={Component}
              pageProps={pageProps}
              pathname={router.pathname}
              isLoading={isLoading}
            />
          </RouteGuard>
        </AccountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}