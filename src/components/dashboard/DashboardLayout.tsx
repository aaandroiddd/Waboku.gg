import { ReactNode, useState, useEffect } from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Footer } from '../Footer';
import { VerificationStatus } from '../VerificationStatus';
import { SellerBadge } from '../SellerBadge';
import { AdminBadge } from '../AdminBadge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GlobalLoading } from '@/components/GlobalLoading';
import { DashboardLoadingScreen } from '@/components/DashboardLoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent } from '@/components/ui/card';
import { getAuthToken } from '@/lib/auth-token-manager';
import { useListings } from '@/hooks/useListings';
import { useProfile } from '@/hooks/useProfile';
import { useDashboardListingsCache } from '@/hooks/useDashboardCache';

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreloading, setIsPreloading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const router = useRouter();
  
  // Check if current page is the main dashboard page
  const isMainDashboardPage = router.pathname === '/dashboard' || router.pathname === '/dashboard/index';
  
  // Initialize dashboard data caching
  const { 
    cachedListings, 
    saveListingsToCache, 
    isInitialized: cacheInitialized 
  } = useDashboardListingsCache({ 
    userId: user?.uid,
    expirationMinutes: 60 // Cache for 1 hour
  });
  
  // Preload listings data while showing loading screen
  const { 
    listings: preloadedListings, 
    loading: listingsLoading, 
    error: listingsError,
    refreshListings
  } = useListings({ 
    userId: user?.uid,
    showOnlyActive: false,
    // Skip initial fetch if we have cached data and we're not on the main dashboard page
    skipInitialFetch: !!cachedListings && !isMainDashboardPage
  });
  
  // Preload user profile data
  const { profile: preloadedProfile, loading: profileLoading } = useProfile(user?.uid || null);
  
  // Check authentication and token validity
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // If no user is logged in, redirect to sign in
        if (!user) {
          console.log('No user found, redirecting to sign in');
          router.push('/auth/sign-in');
          return;
        }
        
        // Try to get a valid auth token to verify authentication
        const token = await getAuthToken(false);
        if (!token) {
          console.error('Failed to get auth token, user may need to re-authenticate');
          setError('Authentication error. Please sign in again.');
          return;
        }
        
        // Start preloading data while showing loading screen
        setIsPreloading(true);
        
        // Check if we have valid cached data
        if (cachedListings && cacheInitialized) {
          console.log('Using cached dashboard data');
          // We have cached data, so we can hide the loading screen sooner
          setTimeout(() => {
            setIsLoading(false);
          }, 500);
        } else if (!isMainDashboardPage) {
          // If we're not on the main dashboard page, don't show the loading screen
          // but still preload data in the background
          setIsLoading(false);
        } else {
          // No cached data and on main dashboard page, wait for preloading to complete
          // The loading screen will remain visible during preloading
        }
      } catch (err) {
        console.error('Error in dashboard auth check:', err);
        setError('An error occurred while checking your authentication. Please try again.');
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [user, router, cachedListings, cacheInitialized, isMainDashboardPage]);
  
  // Handle preloading completion
  useEffect(() => {
    if (!isPreloading || !user) return;
    
    // If we're preloading and have listings data and profile data
    if (!listingsLoading && !profileLoading) {
      // Cache the preloaded listings
      if (preloadedListings && preloadedListings.length > 0) {
        saveListingsToCache(preloadedListings);
      }
      
      // Preloading complete, hide loading screen after a short delay
      setTimeout(() => {
        setIsPreloading(false);
        setIsLoading(false);
      }, 500);
    }
  }, [
    isPreloading, 
    listingsLoading, 
    profileLoading, 
    preloadedListings, 
    saveListingsToCache,
    user
  ]);

  // Show loading state with appropriate step, but only on the main dashboard page
  if (isLoading && isMainDashboardPage) {
    // Calculate loading step based on preloading status
    let currentStep = 1; // Start with authentication step
    let totalSteps = 7; // Total number of steps
    
    if (!listingsLoading && preloadedListings) {
      currentStep = 4; // Listings loaded, processing data
    }
    
    if (!profileLoading && preloadedProfile) {
      currentStep = 6; // Profile loaded, preparing view
    }
    
    if (!isPreloading && cachedListings) {
      currentStep = 7; // Almost done
    }
    
    return (
      <DashboardLoadingScreen 
        message="Preparing your dashboard..." 
        currentStep={currentStep}
        totalSteps={totalSteps}
      />
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 text-red-600 dark:text-red-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">Authentication Error</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => router.push('/')}>
                Go Home
              </Button>
              <Button onClick={() => router.push('/auth/sign-in')}>
                Sign In Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-72 flex-shrink-0">
          <DashboardSidebar />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="md:hidden fixed top-4 left-4 z-40"
              size="icon"
            >
              <MenuIcon className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SheetTitle className="sr-only">Dashboard Navigation</SheetTitle>
            <DashboardSidebar onNavigate={() => setIsSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 md:p-8 pt-16 md:pt-8">
              <div className="flex flex-wrap gap-2 items-center">
                <VerificationStatus />
                {profile?.isAdmin && <AdminBadge />}
              </div>
            </div>
            <main className="flex-1 min-h-0 px-4 md:px-8">
              {children}
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}