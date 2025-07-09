import { installResizeObserverErrorHandler } from '@/lib/resize-observer-error-handler';
installResizeObserverErrorHandler();

import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthRedirectProvider } from '@/contexts/AuthRedirectContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { Toaster } from '@/components/ui/toaster';
import { RouteGuard } from '@/components/RouteGuard';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useState, memo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import { LoadingProvider, useLoading } from '@/contexts/LoadingContext';
import { FirebaseConnectionManager } from '@/components/FirebaseConnectionManager';
import { FirestoreConnectionManager } from '@/components/FirestoreConnectionManager';
import { FirestoreListenerDebugger } from '@/components/FirestoreListenerDebugger';
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary';
import { ListenChannelErrorHandler } from '@/components/ListenChannelErrorHandler';
import { CriticalErrorHandler } from '@/components/CriticalErrorHandler';
import { SessionManagerInitializer } from '@/components/SessionManagerInitializer';
import { ComprehensiveErrorHandlerInitializer } from '@/components/ComprehensiveErrorHandlerInitializer';
import { getFirebaseServices } from '@/lib/firebase';
import { useThemeSync } from '@/hooks/useThemeSync';

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
const MainContent = memo(({ Component, pageProps, pathname }: {
  Component: any;
  pageProps: any;
  pathname: string;
}) => {
  const auth = useAuth();
  const account = useAccount();
  const { isLoading } = useLoading();
  const [isMounted, setIsMounted] = useState(false);
  
  // Use the imported hook directly
  useThemeSync();

  // Set mounted state on client-side and initialize Firebase
  useEffect(() => {
    setIsMounted(true);
    
    // Initialize Firebase services
    getFirebaseServices();
  }, []);

  // Show loading screen while auth or account is initializing
  if (auth.isLoading || account.isLoading) {
    return <LoadingScreen isLoading={true} />;
  }

  // Handle custom layout
  const getLayoutContent = () => {
    // Check if the component has a getLayout function
    if (Component.getLayout) {
      // Apply the custom layout
      return Component.getLayout(<Component {...pageProps} />);
    }
    // Use default layout
    return <Component {...pageProps} />;
  };

  const content = getLayoutContent();

  return (
    <>
      {/* Always show loading screen when isLoading is true */}
      <LoadingScreen isLoading={isLoading} />
      
      {/* PageTransition component handles mobile detection internally */}
      <AnimatePresence mode="wait">
        <PageTransition key={pathname}>
          {content}
        </PageTransition>
      </AnimatePresence>
      
      <Toaster />
      {/* Firebase connection management */}
      {isMounted && (
        <>
          <ComprehensiveErrorHandlerInitializer />
          <SessionManagerInitializer />
          <CriticalErrorHandler />
          <FirebaseConnectionManager />
          <FirestoreConnectionManager />
          <ListenChannelErrorHandler />
          {process.env.NODE_ENV === 'development' && <FirestoreListenerDebugger />}
        </>
      )}
    </>
  );
});

MainContent.displayName = 'MainContent';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const requireAuth = protectedPaths.some(path => 
    router.pathname.startsWith(path)
  );

  return (
    <>
      <Head>
        {/* Preload critical assets */}
        <link rel="preload" href="/images/tcg-bg.svg" as="image" />
        
        {/* Font optimization - using style tag to ensure font is used */}
        <style jsx global>{`
          @font-face {
            font-family: 'Inter';
            font-style: normal;
            font-weight: 100 900;
            font-display: swap;
            src: url('/fonts/inter-var.woff2') format('woff2');
            unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
          }
        `}</style>
      </Head>
      <FirebaseErrorBoundary>
        <ThemeProvider>
          <LoadingProvider>
            <AuthProvider>
              <AuthRedirectProvider>
                <AccountProvider>
                  <UnreadProvider>
                    <TutorialProvider>
                      <RouteGuard requireAuth={requireAuth}>
                        <MainContent 
                          Component={Component}
                          pageProps={pageProps}
                          pathname={router.pathname}
                        />
                      </RouteGuard>
                    </TutorialProvider>
                  </UnreadProvider>
                </AccountProvider>
              </AuthRedirectProvider>
            </AuthProvider>
          </LoadingProvider>
        </ThemeProvider>
      </FirebaseErrorBoundary>
    </>);
}