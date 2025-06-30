import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Skeleton } from './ui/skeleton';
import LoadingScreen from './LoadingScreen';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function RouteGuard({ children, requireAuth = false }: RouteGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { saveRedirectState } = useAuthRedirect();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Only run authorization check if the loading is complete
    if (!isLoading) {
      const authCheck = () => {
        // Allow profile pages without authentication
        if (router.pathname.startsWith('/profile/')) {
          setAuthorized(true);
          return;
        }

        // If auth is required and user is not logged in
        if (requireAuth && !user) {
          setAuthorized(false);
          // Save the current path and any query parameters before redirecting to sign-in
          saveRedirectState('route_guard_redirect', { 
            returnPath: router.asPath,
            query: router.query 
          });
          router.push('/auth/sign-in');
          return;
        }

        // Check if user needs to complete profile
        if (requireAuth && user && typeof window !== 'undefined') {
          const needsProfileCompletion = localStorage.getItem('needs_profile_completion');
          
          if (needsProfileCompletion === 'true' && 
              router.pathname !== '/auth/complete-profile') {
            setAuthorized(false);
            router.push('/auth/complete-profile');
            return;
          }
        }

        // If user is logged in and tries to access auth pages
        if (user && ['/auth/sign-in', '/auth/sign-up'].includes(router.pathname)) {
          setAuthorized(false);
          router.push('/dashboard');
          return;
        }

        // Authorization passed
        setAuthorized(true);
      };

      authCheck();

      // Add route change event listener
      const preventAccess = () => setAuthorized(false);
      router.events.on('routeChangeStart', preventAccess);

      // Clean up event listener
      return () => {
        router.events.off('routeChangeStart', preventAccess);
      };
    }
  }, [isLoading, user, router, requireAuth, saveRedirectState]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-12 w-1/2" />
        </div>
      </div>
    );
  }

  // While checking authorization show loading
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-12 w-1/2" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}