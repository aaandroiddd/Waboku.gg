import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { Toaster } from '@/components/ui/toaster';
import { RouteGuard } from '@/components/RouteGuard';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useState, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import { LoadingProvider, useLoading } from '@/contexts/LoadingContext';
import { FirebaseConnectionHandler } from '@/components/FirebaseConnectionHandler';

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
  const { useThemeSync } = require('@/hooks/useThemeSync');

  // Show loading screen while auth or account is initializing
  if (auth.isLoading || account.isLoading) {
    return <LoadingScreen isLoading={true} />;
  }

  // Initialize theme sync
  useThemeSync();

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      {/* On mobile, we'll use a simpler transition without AnimatePresence to avoid double animations */}
      {typeof window !== 'undefined' && window.innerWidth < 768 ? (
        <PageTransition key={pathname}>
          <Component {...pageProps} />
        </PageTransition>
      ) : (
        <AnimatePresence mode="wait">
          <PageTransition key={pathname}>
            <Component {...pageProps} />
          </PageTransition>
        </AnimatePresence>
      )}
      <Toaster />
      {typeof window !== 'undefined' && <FirebaseConnectionHandler />}
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
        
        {/* Font optimization */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <LoadingProvider>
          <AuthProvider>
            <AccountProvider>
              <UnreadProvider>
                <RouteGuard requireAuth={requireAuth}>
                  <MainContent 
                    Component={Component}
                    pageProps={pageProps}
                    pathname={router.pathname}
                  />
                </RouteGuard>
              </UnreadProvider>
            </AccountProvider>
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </>);
}