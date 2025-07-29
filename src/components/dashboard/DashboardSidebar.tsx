import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { Logo } from '@/components/Logo';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useUnread } from '@/contexts/UnreadContext';
import { useSimplifiedPremiumStatus } from '@/hooks/useSimplifiedPremiumStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogOut, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTheme } from 'next-themes';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const router = useRouter();
  const { user, isEmailVerified, updateProfile } = useAuth();
  const { unreadCounts } = useUnread();
  const { theme, setTheme } = useTheme();
  
  // Use the simplified premium status hook as the single source of truth
  const { isPremium, tier, isLoading: isPremiumLoading, source } = useSimplifiedPremiumStatus();

  // Theme handling function
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'midnight' | 'system') => {
    setTheme(newTheme);
    if (user) {
      try {
        await updateProfile({ theme: newTheme });
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
  };

  // Get theme display name
  const getThemeDisplayName = (themeValue: string | undefined) => {
    switch (themeValue) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'midnight':
        return 'Midnight';
      case 'system':
        return 'System';
      default:
        return 'Theme';
    }
  };

  // Function to render unread badge
  const renderUnreadBadge = (count: number) => {
    if (count <= 0) return null;
    
    return (
      <Badge variant="destructive" className="ml-auto">
        {count > 10 ? '10+' : count}
      </Badge>
    );
  };

  // Base navigation items
  const baseNavigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      name: 'Listings',
      href: '/dashboard/listings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 6h13"/>
          <path d="M8 12h13"/>
          <path d="M8 18h13"/>
          <path d="M3 6h.01"/>
          <path d="M3 12h.01"/>
          <path d="M3 18h.01"/>
        </svg>
      ),
    },
    {
      name: 'Create Listing',
      href: '/dashboard/create-listing',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      ),
    },
    {
      name: 'Notifications',
      href: '/dashboard/notifications',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
      ),
      badge: unreadCounts.notifications,
    },
    {
      name: 'Wanted',
      href: '/dashboard/wanted',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.071 4.929a10 10 0 1 0 0 14.142" />
          <path d="M12 8v4l3 3" />
          <path d="M9 15 3 21" />
          <path d="M14 16.5 21 21" />
        </svg>
      ),
    },
    {
      name: 'Orders',
      href: '/dashboard/orders',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      ),
      badge: unreadCounts.orders,
    },
    {
      name: 'Offers',
      href: '/dashboard/offers',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      badge: unreadCounts.offers,
    },
    {
      name: 'Favorites',
      href: '/dashboard/favorites',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      ),
    },
    {
      name: 'Messages',
      href: '/dashboard/messages',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 10h.01"/>
          <path d="M12 10h.01"/>
          <path d="M16 10h.01"/>
        </svg>
      ),
      badge: unreadCounts.messages,
    },
    {
      name: 'Seller Account',
      href: '/dashboard/seller-account',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      ),
    },
    {
      name: 'Sales Analytics',
      href: '/dashboard/sales-analytics',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
          <path d="M14 15v4h4" />
        </svg>
      ),
    },
    {
      name: 'Reviews',
      href: '/dashboard/reviews',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      ),
    },
    {
      name: 'Account Status',
      href: '/dashboard/account-status',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      name: 'Support Tickets',
      href: '/dashboard/support-tickets',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-6 0v4"/>
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <circle cx="12" cy="16" r="1"/>
        </svg>
      ),
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  // Premium-only navigation items
  const premiumNavItems = [
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      ),
      premium: true,
    },
    {
      name: 'Bulk Listing',
      href: '/dashboard/bulk-listing',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
          <path d="M17 3h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1" />
          <path d="M8 21h8" />
          <path d="M12 3v18" />
          <path d="M3 9h2" />
          <path d="M19 9h2" />
          <path d="M3 6h2" />
          <path d="M19 6h2" />
          <path d="M3 12h18" />
        </svg>
      ),
      premium: true,
    }
  ];

  // Combine navigation items based on premium status
  let navigation = [...baseNavigation];
  
  // Simplified premium feature visibility check
  if (isPremium) {
    // Insert Analytics after Create Listing (index 2)
    navigation.splice(2, 0, ...premiumNavItems);
  }
  
  // Debug logging for premium feature visibility
  if (process.env.NODE_ENV === 'development') {
    console.log('[DashboardSidebar] Premium features visibility:', {
      isPremium,
      tier,
      source,
      userId: user?.uid,
      showingPremiumFeatures: isPremium
    });
  }

  const handleNavigate = (href: string) => {
    router.push(href);
    onNavigate?.();
  };

  // Render a skeleton loader while determining account tier
  const renderSkeletonNavItem = () => (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="h-5 w-5 rounded-md" />
      <Skeleton className="h-4 w-24 rounded-md" />
    </div>
  );

  // Define media query breakpoints
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isSmallMobile = useMediaQuery("(max-width: 380px)");

  return (
    <div className="flex flex-col h-[100dvh] sticky top-0 bg-card border-r">
      {/* Persistent header */}
      <div className="p-6 border-b">
        <Logo className="h-8" alwaysShowFull={true} />
        {user && (
          <div className="mt-4 flex flex-col gap-1">
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            {isEmailVerified() && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-green-500 bg-green-500/10 hover:bg-green-500/20 border-green-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-1"
                      >
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      Verified
                    </div>
                  </div>
                  
                  {/* Theme toggle removed from desktop */}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Scrollable navigation area */}
      <div className="flex-1 flex flex-col py-6 overflow-y-auto">
        {isPremiumLoading ? (
          // Show skeleton loader while loading
          <div className="px-4 space-y-1">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="px-3 py-2.5">
                {renderSkeletonNavItem()}
              </div>
            ))}
          </div>
        ) : (
          // Show actual navigation items once loaded
          <nav className="px-4 space-y-1 flex flex-col h-full">
            <div className="space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavigate(item.href)}
                  className={cn(
                    'flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors',
                    router.pathname === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.icon}
                  {item.name}
                  {item.badge !== undefined && renderUnreadBadge(item.badge)}
                </button>
              ))}
              
              {/* Theme Collapsible */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground">
                    <div className="h-5 w-5 flex items-center justify-center">
                      🎨
                    </div>
                    <span className="flex-1">{getThemeDisplayName(theme)}</span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                      theme === 'light' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    ☀️ Light
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                      theme === 'dark' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    🌙 Dark
                  </button>
                  <button
                    onClick={() => handleThemeChange('midnight')}
                    className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                      theme === 'midnight' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    🌌 Midnight
                  </button>
                  <button
                    onClick={() => handleThemeChange('system')}
                    className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                      theme === 'system' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    💻 System
                  </button>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </nav>
        )}
      </div>
      
      {/* Persistent footer with sign out button */}
      {user && (
        <div className="p-4 border-t bg-card">
          <SignOutButton onNavigate={onNavigate} isMobile={isMobile} />
        </div>
      )}
    </div>
  );
}

// Separate component for sign-out button to avoid React hooks rules issues
function SignOutButton({ onNavigate, isMobile }: { onNavigate?: () => void, isMobile: boolean }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const handleSignOut = async () => {
    try {
      console.log('DashboardSidebar: Initiating sign out process');
      
      // Call onNavigate callback before any async operations
      if (onNavigate) {
        console.log('DashboardSidebar: Calling navigation callback');
        onNavigate();
      }
      
      // Navigate to home page immediately before the async sign-out
      // This helps prevent React state update errors
      console.log('DashboardSidebar: Navigating to home page before sign-out');
      router.push('/').then(() => {
        // Only show toast if we're still on the page
        if (document.visibilityState === 'visible') {
          toast({
            title: "Signing out...",
            description: "Please wait while we sign you out",
            variant: "default",
          });
        }
      }).catch(navError => {
        console.error('DashboardSidebar: Navigation error before sign out:', navError);
      });
      
      // Use a small delay to ensure navigation has started
      setTimeout(async () => {
        try {
          // Then perform sign out
          await signOut();
          console.log('DashboardSidebar: Sign out successful');
          
          // Only show success toast if we're still on the page
          if (document.visibilityState === 'visible') {
            toast({
              title: "Success",
              description: "You have been signed out successfully",
              variant: "default",
            });
          }
        } catch (signOutError) {
          console.error('DashboardSidebar: Error during sign out:', signOutError);
          
          // Extract error message
          let errorMessage = "Failed to sign out. Please try again.";
          if (signOutError instanceof Error) {
            errorMessage = signOutError.message || errorMessage;
          }
          
          // Only show error toast if we're still on the page
          if (document.visibilityState === 'visible') {
            toast({
              title: "Sign Out Error",
              description: errorMessage,
              variant: "destructive",
            });
          }
        }
      }, 100);
    } catch (error) {
      console.error('DashboardSidebar: Unexpected error in sign out handler:', error);
      
      // Navigate to home page on error
      router.push('/').catch(navError => {
        console.error('DashboardSidebar: Navigation error after sign out error:', navError);
      });
    }
  };
  
  // Enhanced styling for better visibility on mobile
  return (
    <button
      onClick={handleSignOut}
      className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-4 hover:bg-accent hover:text-accent-foreground transition-colors bg-red-500/10 text-red-500 hover:text-red-600"
      style={{ minHeight: isMobile ? '56px' : 'auto' }}
    >
      <LogOut className="h-5 w-5" />
      <span className="font-medium">Sign Out</span>
    </button>
  );
}