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
import { useState, useCallback } from "react";
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

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };
  
  const { toast } = useToast();
  
  const handleSignOut = async () => {
    try {
      console.log('Header: Initiating sign out process');
      await signOut();
      
      // Always close the mobile menu regardless of success/failure
      setIsMobileMenuOpen(false);
      
      // Navigate to home page
      console.log('Header: Sign out successful, navigating to home page');
      router.push('/');
      
      // Show success toast notification
      toast({
        title: "Success",
        description: "You have been signed out successfully",
        variant: "default",
      });
    } catch (error) {
      console.error('Header: Error signing out:', error);
      
      // Close mobile menu even on error
      setIsMobileMenuOpen(false);
      
      // Extract error message
      let errorMessage = "Failed to sign out. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }
      
      // Show error toast with more specific message if available
      toast({
        title: "Sign Out Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Still try to navigate to home page on error
      try {
        router.push('/');
      } catch (navError) {
        console.error('Header: Navigation error after failed sign out:', navError);
      }
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
              className="w-[280px] sm:w-[320px] will-change-transform"
              style={{ 
                transform: 'translateZ(0)', // Force hardware acceleration
                overscrollBehavior: 'contain' // Prevent scroll chaining
              }}
            >
              <SheetHeader className="mb-4">
                <SheetTitle>Menu</SheetTitle>
                {user && (
                  <Button
                    variant="destructive"
                    className="flex items-center justify-start gap-2 h-auto py-2 mt-2 bg-[#b71c1c] hover:bg-[#b71c1c]/90"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                )}
              </SheetHeader>
              <nav 
                className="flex flex-col space-y-3 overflow-y-auto overscroll-contain"
                style={{ 
                  WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                  maxHeight: 'calc(100vh - 6rem)' // Prevent overflow issues
                }}
              >
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
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}