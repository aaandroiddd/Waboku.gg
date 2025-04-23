import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, LayoutDashboard, Heart, MessageSquare, Settings, Store, LogOut } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
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
  
  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
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
        stiffness: isMobile ? 120 : 100,
        duration: isMobile ? 0.2 : 0.3
      }
    }
  };

  return (
    <motion.header 
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      initial={animate ? "hidden" : "visible"}
      animate="visible"
      variants={headerVariants}
      // Add layout="preserved" to maintain layout during animation
      layout="preserved"
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
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={isMobileMenuOpen} onOpenChange={handleMenuToggle}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden will-change-transform"
                style={{ transform: 'translateZ(0)' }} // Force hardware acceleration
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="right" 
              className="w-[280px] sm:w-[320px] p-0 flex flex-col"
              style={{ 
                height: '100dvh', // Use dynamic viewport height for better mobile support
                maxHeight: '100dvh',
                overscrollBehavior: 'contain', // Prevent scroll chaining
              }}
            >
              {/* Header section */}
              <div className="p-6 pb-2 flex-shrink-0 border-b">
                <SheetHeader className="mb-0">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
              </div>
              
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto">
                <nav className="flex flex-col space-y-3 p-6 pt-4">
                  <Link 
                    href="/" 
                    className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-md transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                    prefetch={false} // Prevent prefetching for better performance
                  >
                    Home
                  </Link>
                  <Link 
                    href="/listings" 
                    className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-md transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                    prefetch={false}
                  >
                    Browse Listings
                  </Link>
                  <Link 
                    href="/wanted" 
                    className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-md transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                    prefetch={false}
                  >
                    Wanted Board
                  </Link>
                  
                  {user ? (
                    <>
                      <div className="pt-2 pb-2">
                        <div className="text-sm font-medium text-muted-foreground px-2">
                          Welcome, {profile?.username || 'User'}!
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="flex items-center justify-start gap-2 h-auto py-2"
                        onClick={() => handleNavigation('/dashboard')}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard Overview
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex items-center justify-start gap-2 h-auto py-2"
                        onClick={() => handleNavigation('/dashboard/create-listing')}
                      >
                        <Store className="h-4 w-4" />
                        Create Listing
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex items-center justify-start gap-2 h-auto py-2"
                        onClick={() => handleNavigation('/dashboard/favorites')}
                      >
                        <Heart className="h-4 w-4" />
                        Favorites
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex items-center justify-start gap-2 h-auto py-2"
                        onClick={() => handleNavigation('/dashboard/messages')}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Messages
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex items-center justify-start gap-2 h-auto py-2"
                        onClick={() => handleNavigation('/dashboard/settings')}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 pt-2">
                      <Link href="/auth/sign-in" prefetch={false}>
                        <Button variant="outline" className="w-full">Sign In</Button>
                      </Link>
                      <Link href="/auth/sign-up" prefetch={false}>
                        <Button className="w-full bg-sky-400 hover:bg-sky-500">Get Started</Button>
                      </Link>
                    </div>
                  )}
                </nav>
              </div>
              
              {/* Fixed footer with sign out button */}
              {user && (
                <div className="p-6 pt-4 border-t flex-shrink-0 bg-background">
                  <Button
                    variant="destructive"
                    className="flex items-center justify-start gap-2 h-auto py-2 w-full bg-[#b71c1c] hover:bg-[#b71c1c]/90"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}