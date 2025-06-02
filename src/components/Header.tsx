import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, LayoutDashboard, Heart, MessageSquare, Settings, Store, LogOut, Home, Search, ClipboardList } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, useReducedMotion } from "framer-motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/components/ui/use-toast";

// Dynamically import the auth-dependent navigation component
const AuthNav = dynamic(() => import("./AuthNav"), {
  ssr: false,
});

interface HeaderProps {
  animate?: boolean;
}

export default function Header({ animate = true }: HeaderProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const isAuthPage = router.pathname.startsWith("/auth/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersReducedMotion = useReducedMotion();
  
  // State for scroll-based header visibility
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollThreshold = 10; // Minimum scroll difference to trigger header visibility change
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Throttle menu opening/closing to prevent performance issues
  const handleMenuToggle = useCallback((open: boolean) => {
    if (isMenuAnimating) return;
    
    setIsMenuAnimating(true);
    setIsMobileMenuOpen(open);
    
    // Reset animation lock after animation completes
    setTimeout(() => {
      setIsMenuAnimating(false);
    }, 300); // Match this with the animation duration
  }, [isMenuAnimating]);
  
  // Control header visibility based on scroll direction
  const controlHeader = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    // Always show header when at the top of the page
    if (currentScrollY <= 10) {
      setShowHeader(true);
      setLastScrollY(currentScrollY);
      return;
    }
    
    // Only update if we've scrolled more than the threshold
    if (Math.abs(currentScrollY - lastScrollY) > scrollThreshold) {
      // Show header when scrolling up, hide when scrolling down
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down & not at the top
        setShowHeader(false);
      } else {
        // Scrolling up
        setShowHeader(true);
      }
      
      // Update last scroll position
      setLastScrollY(currentScrollY);
    }
  }, [lastScrollY, scrollThreshold]);
  
  // Add scroll event listener with throttling
  useEffect(() => {
    // Skip for non-browser environments
    if (typeof window === 'undefined') return;
    
    const handleScroll = () => {
      // Throttle scroll events
      if (scrollTimeoutRef.current) return;
      
      scrollTimeoutRef.current = setTimeout(() => {
        controlHeader();
        scrollTimeoutRef.current = null;
      }, 50); // Throttle to 20 times per second for more responsive behavior
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Force header visibility check on mount and when component updates
    controlHeader();
    
    // Also add a check when user stops scrolling
    const handleScrollEnd = () => {
      // Wait a bit after scrolling stops to ensure we have the final position
      setTimeout(() => {
        // If we're at the top, always show the header
        if (window.scrollY <= 10) {
          setShowHeader(true);
        }
      }, 150);
    };
    
    window.addEventListener('scrollend', handleScrollEnd);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scrollend', handleScrollEnd);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [controlHeader]);
  
  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
      
      // Always show header when menu is open
      setShowHeader(true);
    } else {
      // Unlock body scroll and restore position
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }
    
    return () => {
      // Clean up in case component unmounts while menu is open
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isMobileMenuOpen]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };
  
  const { toast } = useToast();
  
  const handleSignOut = async () => {
    try {
      console.log('Header: Initiating sign out process');
      
      // First close the mobile menu before any async operations
      setIsMobileMenuOpen(false);
      
      // Show toast immediately
      toast({
        title: "Signing out...",
        description: "Please wait while we sign you out",
        variant: "default",
      });
      
      // Directly call signOut without navigation or delays
      try {
        await signOut();
        console.log('Header: Sign out successful');
        
        // The signOut function already handles navigation to home page
        // No need to show success toast as the page will reload
      } catch (signOutError) {
        console.error('Header: Error during sign out:', signOutError);
        
        // Extract error message
        let errorMessage = "Failed to sign out. Please try again.";
        if (signOutError instanceof Error) {
          errorMessage = signOutError.message || errorMessage;
        }
        
        toast({
          title: "Sign Out Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Header: Unexpected error in sign out handler:', error);
      
      toast({
        title: "Sign Out Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Simplified animation variants for mobile
  const headerVariants = {
    hidden: { y: 0, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: prefersReducedMotion || isMobile ? "tween" : "spring",
        damping: isMobile ? 25 : 20,
        stiffness: isMobile ? 100 : 100,
        duration: isMobile ? 0.15 : 0.2
      }
    }
  };

  // Animation variants for header show/hide - simplified for mobile
  const showHideVariants = {
    visible: { 
      y: 0,
      opacity: 1,
      transition: {
        y: { 
          type: isMobile ? "tween" : "spring", 
          stiffness: isMobile ? undefined : 300, 
          damping: isMobile ? undefined : 30,
          duration: isMobile ? 0.15 : undefined
        },
        opacity: { duration: isMobile ? 0.1 : 0.2 }
      }
    },
    hidden: { 
      y: -60,
      opacity: 0,
      transition: {
        y: { 
          type: isMobile ? "tween" : "spring", 
          stiffness: isMobile ? undefined : 300, 
          damping: isMobile ? undefined : 30,
          duration: isMobile ? 0.15 : undefined
        },
        opacity: { duration: isMobile ? 0.1 : 0.2 }
      }
    }
  };

  // Add mouse movement detection to ensure header is visible when user is active
  useEffect(() => {
    const handleMouseMove = () => {
      // If we're near the top of the page, make sure header is visible
      if (window.scrollY < 100) {
        setShowHeader(true);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return (
    <motion.header 
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      initial={animate ? "hidden" : "visible"}
      animate={showHeader ? "visible" : "hidden"}
      variants={showHideVariants}
      // Add layout="preserved" to maintain layout during animation
      layout="preserved"
      // Add onMouseEnter to ensure header is visible when hovered
      onMouseEnter={() => setShowHeader(true)}
      style={{ willChange: "transform, opacity" }}
    >
      <div className="container mx-auto px-4 h-10 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-4">
          {/* Desktop navigation links removed as requested */}
          <div className="flex items-center">
            <ThemeToggle />
          </div>
          {!isAuthPage && (
            <div className="flex items-center">
              <AuthNav />
              {user && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="gap-2 ml-2 bg-[#b71c1c] hover:bg-[#b71c1c]/90" 
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              )}
            </div>
          )}
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center space-x-2"> {/* Added space-x-2 for spacing */}
          {user && (
            <span 
              className="h-2.5 w-2.5 rounded-full bg-green-500" 
              title="Logged In"
              aria-label="Logged In Status: Active"
            ></span>
          )}
          <Sheet open={isMobileMenuOpen} onOpenChange={handleMenuToggle}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                style={{ 
                  willChange: "transform", 
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }} // Enhanced hardware acceleration
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="left" 
              className="p-0 w-72"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              
              {/* Dashboard-style sidebar with fixed header, scrollable content, and fixed footer */}
              <div className="flex flex-col h-[100dvh] bg-card">
                {/* Persistent header with logo and user info */}
                <div className="p-6 border-b">
                  <Logo className="h-8" alwaysShowFull={true} />
                  {user && (
                    <div className="mt-4 flex flex-col gap-1">
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  )}
                </div>
                
                {/* Scrollable navigation area */}
                <div className="flex-1 flex flex-col py-6 overflow-y-auto">
                  <nav className="px-4 space-y-1 flex flex-col h-full">
                    <div className="space-y-1">
                      <button
                        onClick={() => handleNavigation('/')}
                        className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                          router.pathname === '/' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <Home className="h-5 w-5" />
                        Home
                      </button>
                      
                      <button
                        onClick={() => handleNavigation('/listings')}
                        className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                          router.pathname.startsWith('/listings') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <Search className="h-5 w-5" />
                        Browse Listings
                      </button>
                      
                      <button
                        onClick={() => handleNavigation('/wanted')}
                        className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                          router.pathname.startsWith('/wanted') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <ClipboardList className="h-5 w-5" />
                        Wanted Board
                      </button>
                      
                      {user ? (
                        <>
                          <div className="h-px bg-border my-4"></div>
                          
                          <button
                            onClick={() => handleNavigation('/dashboard')}
                            className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                              router.pathname === '/dashboard' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            <LayoutDashboard className="h-5 w-5" />
                            Dashboard
                          </button>
                          
                          <button
                            onClick={() => handleNavigation('/dashboard/create-listing')}
                            className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                              router.pathname === '/dashboard/create-listing' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            <Store className="h-5 w-5" />
                            Create Listing
                          </button>
                          
                          <button
                            onClick={() => handleNavigation('/dashboard/favorites')}
                            className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                              router.pathname === '/dashboard/favorites' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            <Heart className="h-5 w-5" />
                            Favorites
                          </button>
                          
                          <button
                            onClick={() => handleNavigation('/dashboard/messages')}
                            className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                              router.pathname === '/dashboard/messages' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            <MessageSquare className="h-5 w-5" />
                            Messages
                          </button>
                          
                          <button
                            onClick={() => handleNavigation('/dashboard/settings')}
                            className={`flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors ${
                              router.pathname === '/dashboard/settings' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            <Settings className="h-5 w-5" />
                            Settings
                          </button>
                          
                          {/* Theme Toggle for logged in users */}
                          <div className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 text-muted-foreground">
                            <div className="h-5 w-5 flex items-center justify-center">
                              🎨
                            </div>
                            <span className="flex-1">Theme</span>
                            <ThemeToggle />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col gap-2 pt-4 px-3">
                            <Link href="/auth/sign-in" prefetch={false} onClick={() => setIsMobileMenuOpen(false)}>
                              <Button variant="outline" className="w-full">Sign In</Button>
                            </Link>
                            <Link href="/auth/sign-up" prefetch={false} onClick={() => setIsMobileMenuOpen(false)}>
                              <Button className="w-full bg-sky-400 hover:bg-sky-500">Get Started</Button>
                            </Link>
                          </div>
                          
                          {/* Theme Toggle for logged out users */}
                          <div className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 text-muted-foreground mt-4">
                            <div className="h-5 w-5 flex items-center justify-center">
                              🎨
                            </div>
                            <span className="flex-1">Theme</span>
                            <ThemeToggle />
                          </div>
                        </>
                      )}
                    </div>
                  </nav>
                </div>
                
                {/* Persistent footer with sign out button */}
                {user && (
                  <div className="p-4 border-t bg-card">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-3.5 hover:bg-accent hover:text-accent-foreground transition-colors bg-red-500/10 text-red-500 hover:text-red-600"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}