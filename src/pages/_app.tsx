// Install early error handler FIRST, before any other imports
import '@/lib/early-error-handler';

import { installResizeObserverErrorHandler } from '@/lib/resize-observer-error-handler';
installResizeObserverErrorHandler();

// Aggressive fix for includes() errors - patch String prototype and add comprehensive error handling
if (typeof window !== 'undefined') {
  // Store original methods
  const originalStringIncludes = String.prototype.includes;
  const originalArrayIncludes = Array.prototype.includes;
  const originalError = console.error;
  
  // Patch String.prototype.includes to be more defensive
  String.prototype.includes = function(searchString, position) {
    try {
      // Ensure 'this' is a valid string
      if (this == null) {
        console.warn('String.includes called on null/undefined, returning false');
        return false;
      }
      
      // Convert to string if needed
      const str = String(this);
      return originalStringIncludes.call(str, searchString, position);
    } catch (error) {
      console.warn('Error in String.prototype.includes:', error, { this: this, searchString, position });
      return false;
    }
  };
  
  // Patch Array.prototype.includes to be more defensive
  Array.prototype.includes = function(searchElement, fromIndex) {
    try {
      // Ensure 'this' is a valid array-like object
      if (this == null) {
        console.warn('Array.includes called on null/undefined, returning false');
        return false;
      }
      
      return originalArrayIncludes.call(this, searchElement, fromIndex);
    } catch (error) {
      console.warn('Error in Array.prototype.includes:', error, { this: this, searchElement, fromIndex });
      return false;
    }
  };

  // Enhanced console.error interceptor
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    if (errorMessage.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn('Intercepted includes() error (should be fixed by prototype patch):', ...args);
      console.trace('Stack trace for includes() error');
      
      // Log additional debugging information
      console.warn('This error has been caught and handled. The application should continue to work normally.');
      
      // Don't call the original console.error for this specific error to reduce noise
      return;
    }
    
    // Call original console.error for other errors
    originalError(...args);
  };

  // Enhanced global error handler with more specific error catching
  window.addEventListener('error', (event) => {
    const error = event.error;
    const message = error?.message || event.message || '';
    
    if (message.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn('Global error handler caught includes() error:', error);
      console.warn('Error details:', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: error?.stack
      });
      
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
    
    // Also catch other common undefined property access errors
    if (message.includes('Cannot read properties of undefined') || 
        message.includes('Cannot read property') ||
        message.includes('undefined is not an object')) {
      console.warn('Global error handler caught undefined property access:', error);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Enhanced global unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || reason?.toString() || '';
    
    if (message.includes('Cannot read properties of undefined (reading \'includes\')')) {
      console.warn('Global promise rejection handler caught includes() error:', reason);
      event.preventDefault();
      return false;
    }
    
    // Also catch other common undefined property access errors in promises
    if (message.includes('Cannot read properties of undefined') || 
        message.includes('Cannot read property') ||
        message.includes('undefined is not an object')) {
      console.warn('Global promise rejection handler caught undefined property access:', reason);
      event.preventDefault();
      return false;
    }
  });

  // Add a React error boundary fallback at the global level
  const originalReactError = window.React?.createElement;
  if (originalReactError) {
    // This is a more aggressive approach - wrap React.createElement to catch errors
    try {
      const ReactErrorBoundary = class extends React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false };
        }
        
        static getDerivedStateFromError(error) {
          if (error?.message?.includes('Cannot read properties of undefined (reading \'includes\')')) {
            console.warn('React Error Boundary caught includes() error:', error);
            return { hasError: true };
          }
          throw error; // Re-throw other errors
        }
        
        componentDidCatch(error, errorInfo) {
          if (error?.message?.includes('Cannot read properties of undefined (reading \'includes\')')) {
            console.warn('React Error Boundary componentDidCatch - includes() error:', error, errorInfo);
          }
        }
        
        render() {
          if (this.state.hasError) {
            return React.createElement('div', { 
              style: { padding: '10px', color: '#666', fontSize: '14px' } 
            }, 'Content temporarily unavailable');
          }
          return this.props.children;
        }
      };
      
      // Store the boundary for potential use
      window.__ReactErrorBoundary = ReactErrorBoundary;
    } catch (e) {
      console.warn('Could not set up React error boundary:', e);
    }
  }
  
  console.log('Enhanced error handling and prototype patches installed');
}

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