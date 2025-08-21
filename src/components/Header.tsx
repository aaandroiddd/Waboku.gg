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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Menu, LayoutDashboard, Heart, MessageSquare, Settings, Store, LogOut, Home, Search, ClipboardList, ChevronDown, Gamepad2 } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/components/ui/use-toast";
import { NotificationBell } from "./NotificationBell";
import SearchBar from "./SearchBar";
import { useTrendingSearches } from "@/hooks/useTrendingSearches";
import { 
  GAME_MAPPING, 
  OTHER_GAME_MAPPING, 
  MAIN_GAME_CATEGORIES, 
  OTHER_GAME_CATEGORIES,
  GameCategory,
  GAME_ICONS
} from "@/lib/game-mappings";

// Dynamically import the auth-dependent navigation component
const AuthNav = dynamic(() => import("./AuthNav"), {
  ssr: false,
});

interface HeaderProps {
  animate?: boolean;
}

export default function Header({ animate = true }: HeaderProps) {
  const router = useRouter();
  const { user, profile, signOut, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const isAuthPage = router.pathname.startsWith("/auth/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { recordSearch } = useTrendingSearches();
  
  // Mobile search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Simplified menu toggle without animation delays
  const handleMenuToggle = useCallback((open: boolean) => {
    setIsMobileMenuOpen(open);
  }, []);
  
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

  const handleCategoryClick = (category?: GameCategory) => {
    const query = category 
      ? { game: category === "Magic: The Gathering" 
          ? "mtg" 
          : GAME_MAPPING[category as keyof typeof GAME_MAPPING] || 
            OTHER_GAME_MAPPING[category as keyof typeof OTHER_GAME_MAPPING] } 
      : {}
    
    router.push({
      pathname: "/listings",
      query,
    });
    setIsMobileMenuOpen(false);
  };

  // Handle search from mobile search bar
  const handleMobileSearch = useCallback(async (query: string) => {
    try {
      if (query.trim()) {
        await recordSearch(query.trim());
      }
      
      const queryParams: Record<string, string> = {};
      
      if (query.trim()) {
        queryParams.query = query;
      }

      if (Object.keys(queryParams).length > 0) {
        router.push({
          pathname: '/listings',
          query: queryParams,
        });
      } else {
        router.push('/listings');
      }
    } catch (error) {
      console.error('Mobile search error:', error);
    }
  }, [router, recordSearch]);

  // Handle card selection from mobile search
  const handleMobileCardSelect = useCallback((cardName: string) => {
    setSearchQuery(cardName);
    handleMobileSearch(cardName);
  }, [handleMobileSearch]);

  // Update search query from router if present
  useEffect(() => {
    if (router && typeof router.query?.query === "string") {
      setSearchQuery(router.query.query);
    }
  }, [router.query?.query]);
  
  const { toast } = useToast();
  
  // Theme handling function
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'midnight' | 'system') => {
    try {
      setTheme(newTheme);
      if (user) {
        await updateProfile({ theme: newTheme });
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex flex-col">
        {/* Main header row */}
        <div className="h-10 flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {user && <NotificationBell />}
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
          <div className="md:hidden flex items-center space-x-2">
            {user && <NotificationBell />}
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
                        
                        {/* Game Categories Collapsible */}
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground">
                              <Gamepad2 className="h-5 w-5" />
                              <span className="flex-1">Game Categories</span>
                              <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1 mt-1">
                            <button
                              onClick={() => handleCategoryClick()}
                              className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                                !router.query.game ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              🎯 All Categories
                            </button>
                            {MAIN_GAME_CATEGORIES.map((category) => {
                              const gameKey = GAME_MAPPING[category];
                              const icon = GAME_ICONS[gameKey] || '🎮';
                              return (
                                <button
                                  key={category}
                                  onClick={() => handleCategoryClick(category)}
                                  className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                                    router.query.game === gameKey ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                                  }`}
                                >
                                  {icon} {category}
                                </button>
                              );
                            })}
                            {OTHER_GAME_CATEGORIES.map((category) => {
                              const gameKey = OTHER_GAME_MAPPING[category];
                              const icon = GAME_ICONS[gameKey] || '🎮';
                              return (
                                <button
                                  key={category}
                                  onClick={() => handleCategoryClick(category)}
                                  className={`flex items-center w-full gap-3 text-sm rounded-md px-6 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                                    router.query.game === gameKey ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                                  }`}
                                >
                                  {icon} {category}
                                </button>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                        
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
                            
                            {/* Theme Collapsible for logged in users */}
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
                            
                            {/* Theme Collapsible for logged out users */}
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center w-full gap-3 text-sm font-medium rounded-md px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground mt-4">
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

        {/* Desktop search bar row */}
        <div className="hidden md:block pb-3 pt-2">
          <div className="px-2">
            <SearchBar
              onSelect={handleMobileCardSelect}
              onSearch={handleMobileSearch}
              initialValue={searchQuery}
              showSearchButton={false}
            />
          </div>
        </div>

        {/* Mobile search bar row */}
        <div className="md:hidden pb-3 pt-2">
          <div className="px-2">
            <SearchBar
              onSelect={handleMobileCardSelect}
              onSearch={handleMobileSearch}
              initialValue={searchQuery}
              showSearchButton={true}
            />
          </div>
        </div>
      </div>
    </header>
  );
}