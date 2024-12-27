import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { RouteGuard } from '@/components/RouteGuard';

const protectedPaths = [
  '/dashboard',
  '/profile',
  '/listings/create',
  '/messages',
  '/settings',
];

export default function App({ Component, pageProps, router }: AppProps) {
  const requireAuth = protectedPaths.some(path => 
    router.pathname.startsWith(path)
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <RouteGuard requireAuth={requireAuth}>
          <Component {...pageProps} />
          <Toaster />
        </RouteGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}