// Install enhanced error handler FIRST, before any other imports
import { initializeEnhancedErrorHandler, initializeFirestoreRecovery } from '@/lib/enhanced-error-handler';
import { initializeFirestoreSessionManagement } from '@/lib/firestore-session-manager';

// Initialize enhanced error handling immediately
if (typeof window !== 'undefined') {
  initializeEnhancedErrorHandler();
  initializeFirestoreRecovery();
  initializeFirestoreSessionManagement();
}

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

import { LoadingProvider, useLoading } from '@/contexts/LoadingContext';
import { FirebaseConnectionManager } from '@/components/FirebaseConnectionManager';
import { FirestoreConnectionManager } from '@/components/FirestoreConnectionManager';
import { FirestoreListenerDebugger } from '@/components/FirestoreListenerDebugger';
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary';
import { EnhancedErrorBoundary } from '@/components/EnhancedErrorBoundary';
import { ListenChannelErrorHandler } from '@/components/ListenChannelErrorHandler';
import { FirestoreListenChannelHandler } from '@/components/FirestoreListenChannelHandler';
import { CriticalErrorHandler } from '@/components/CriticalErrorHandler';
import { SessionManagerInitializer } from '@/components/SessionManagerInitializer';
import { ComprehensiveErrorHandlerInitializer } from '@/components/ComprehensiveErrorHandlerInitializer';
import { getFirebaseServices } from '@/lib/firebase';
import { useThemeSync } from '@/hooks/useThemeSync';
import { performanceOptimizer } from '@/lib/performance-optimizer';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';

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
          <FirestoreListenChannelHandler />
          {process.env.NODE_ENV === 'development' && <FirestoreListenerDebugger />}
          {/* Performance Monitor - only shows in development by default */}
          <PerformanceMonitor />
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
      <EnhancedErrorBoundary>
        <FirebaseErrorBoundary>
          <ThemeProvider>
            <LoadingProvider>
              <AuthProvider>
                <AuthRedirectProvider>
                  <AccountProvider>
                    <UnreadProvider>
                      <TutorialProvider>
                        <RouteGuard requireAuth={requireAuth}>
                          <EnhancedErrorBoundary>
                            <MainContent 
                              Component={Component}
                              pageProps={pageProps}
                              pathname={router.pathname}
                            />
                          </EnhancedErrorBoundary>
                        </RouteGuard>
                      </TutorialProvider>
                    </UnreadProvider>
                  </AccountProvider>
                </AuthRedirectProvider>
              </AuthProvider>
            </LoadingProvider>
          </ThemeProvider>
        </FirebaseErrorBoundary>
      </EnhancedErrorBoundary>
    </>);
}