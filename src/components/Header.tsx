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
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SignOutDialog } from "./SignOutDialog";

// Dynamically import the auth-dependent navigation component
const AuthNav = dynamic(() => import("./AuthNav"), {
  ssr: false,
});

export default function Header() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const isAuthPage = router.pathname.startsWith("/auth/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    setIsMobileMenuOpen(false);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-12 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-4">
          <div className="flex items-center space-x-4 mr-4">
            <Link href="/listings" className="text-sm font-medium hover:text-primary">
              Browse Listings
            </Link>
            <Link href="/wanted" className="text-sm font-medium hover:text-primary">
              Wanted Board
            </Link>
          </div>
          <div className="flex items-center">
            <ThemeToggle />
          </div>
          {!isAuthPage && (
            <div className="flex items-center">
              <AuthNav />
            </div>
          )}
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader className="mb-4">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-3">
                <Link 
                  href="/" 
                  className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-md transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link 
                  href="/listings" 
                  className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-md transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Browse Listings
                </Link>
                <Link 
                  href="/wanted" 
                  className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-md transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
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
                    <Button
                      variant="ghost"
                      className="flex items-center justify-start gap-2 h-auto py-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setShowSignOutDialog(true)}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 pt-2">
                    <Link href="/auth/sign-in">
                      <Button variant="outline" className="w-full">Sign In</Button>
                    </Link>
                    <Link href="/auth/sign-up">
                      <Button className="w-full bg-sky-400 hover:bg-sky-500">Get Started</Button>
                    </Link>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <SignOutDialog
        isOpen={showSignOutDialog}
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutDialog(false)}
      />
    </header>
  );
}