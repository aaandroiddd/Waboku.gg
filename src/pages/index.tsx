import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRouter } from "next/router";
import SearchBar from "@/components/SearchBar";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { Footer } from "@/components/Footer";
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from "next/head";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { LogIn, UserPlus, Clock, MapPin, Sparkles, LayoutGrid, Square, Image } from "lucide-react";
import { TrendingSearches } from "@/components/TrendingSearches";
import { checkAndClearStaleAuthData } from "@/lib/auth-token-manager";
import StaticBackground from "@/components/StaticBackground";
import { ContentLoader } from "@/components/ContentLoader";
import { useListings } from "@/hooks/useListings";
import { useTrendingSearches } from "@/hooks/useTrendingSearches";
import Link from "next/link";
import { FirebaseConnectionHandler } from "@/components/FirebaseConnectionHandler";
import { StateSelect } from "@/components/StateSelect";
import { useAnimationConfig } from "@/hooks/useOptimizedMediaQuery";
import ScrollIndicator from "@/components/ScrollIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { 
  GAME_MAPPING, 
  OTHER_GAME_MAPPING, 
  MAIN_GAME_CATEGORIES, 
  OTHER_GAME_CATEGORIES,
  GameCategory
} from "@/lib/game-mappings";

// Subtitles array - moved outside component to prevent recreation on each render
const subtitles = [
  "Your deck isn't 'meta' until your wallet cries.",
  "One more booster won't hurt—unless it's another bulk rare.",
  "Foils don't pay the rent, but they do bring happiness.",
  "Your binder is worth more than your car, and you're proud of it.",
  "Yes, you do need three more for a playset.",
  "Why invest in stocks when you have cards?",
  "It's not hoarding if they're neatly in sleeves.",
  "The real TCG battle? Justifying this hobby to your bank account.",
  "Budget deck? Never heard of her.",
  "Draft night: where your self-control goes to die.",
  "Your deck isn't bad, it's just too advanced for winning.",
  "Your biggest L wasn't misplaying—it was opening that $100 box for $5 of bulk.",
  "Alt-art cards appreciate in value. Your self-control doesn't."
];

// Simple error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">Please refresh the page to try again.</p>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Optimized animation variants factory
const createAnimationVariants = (animationConfig: any) => {
  const { shouldAnimate, duration, stagger, ease } = animationConfig;
  
  if (!shouldAnimate) {
    return {
      container: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
      },
      heroBackground: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
      },
      item: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
      }
    };
  }

  return {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: stagger,
          delayChildren: duration * 0.5,
          duration,
          ease
        }
      }
    },
    heroBackground: {
      hidden: { 
        opacity: 0,
        ...(duration > 0.3 && { scale: 1.1 })
      },
      visible: { 
        opacity: 1,
        scale: 1,
        transition: {
          duration: duration * 2,
          ease
        }
      }
    },
    item: {
      hidden: { 
        opacity: 0, 
        ...(duration > 0.3 && { y: 20 })
      },
      visible: {
        opacity: 1,
        y: 0,
        transition: duration > 0.3 ? {
          type: "spring",
          damping: 12,
          stiffness: 100
        } : {
          duration,
          ease
        }
      }
    }
  };
};

// Optimized Motion Component
const OptimizedMotion = ({ 
  children, 
  variants, 
  initial = "hidden", 
  animate = "visible",
  className,
  style,
  shouldAnimate = true,
  ...props 
}: any) => {
  if (!shouldAnimate) {
    return <div className={className} style={style}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      style={{ 
        willChange: "transform, opacity",
        ...style 
      }}
      variants={variants}
      initial={initial}
      animate={animate}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Lazy-loaded section component
const LazySection = ({ children, className, threshold = 0.1, minHeight = "200px", ...props }: any) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { 
    once: true, 
    threshold,
    margin: "50px 0px"
  });
  
  return (
    <div ref={ref} className={className} {...props}>
      {isInView ? children : <div style={{ minHeight }} />}
    </div>
  );
};

// Sidebar Game Categories Component
const SidebarGameCategories = ({ onCategoryClick, currentGame }: any) => {
  return (
    <div className="space-y-2">
      <Button
        variant={!currentGame ? "default" : "ghost"}
        size="sm"
        className="w-full justify-start text-sm"
        onClick={() => onCategoryClick()}
      >
        All Categories
      </Button>
      {MAIN_GAME_CATEGORIES.map((category) => (
        <Button
          key={category}
          variant={currentGame === GAME_MAPPING[category] ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start text-sm"
          onClick={() => onCategoryClick(category)}
        >
          {category}
        </Button>
      ))}
      <Separator className="my-2" />
      <div className="text-xs font-medium text-muted-foreground px-2 py-1">More Games</div>
      {OTHER_GAME_CATEGORIES.map((category) => (
        <Button
          key={category}
          variant={currentGame === OTHER_GAME_MAPPING[category] ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start text-sm"
          onClick={() => onCategoryClick(category)}
        >
          {category}
        </Button>
      ))}
    </div>
  );
};

export default function Home() {
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [displayCount, setDisplayCount] = useState(8);
  const [connectionError, setConnectionError] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'default' | 'single' | 'image-only'>('default');

  // Persist grid view mode across pages (mobile + desktop share same preference)
  const GRID_VIEW_MODE_STORAGE_KEY = 'listingGridViewMode';
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(GRID_VIEW_MODE_STORAGE_KEY);
        if (saved === 'default' || saved === 'single' || saved === 'image-only') {
          setMobileViewMode(saved as 'default' | 'single' | 'image-only');
        }
      } catch (e) {
        console.warn('Failed to read grid view mode from storage', e);
      }
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(GRID_VIEW_MODE_STORAGE_KEY, mobileViewMode);
      } catch (e) {
        console.warn('Failed to persist grid view mode', e);
      }
    }
  }, [mobileViewMode]);
  const cycleGridViewMode = useCallback(() => {
    setMobileViewMode((prev) =>
      prev === 'default' ? 'image-only' : 'default'
    );
  }, []);

  // Use useMemo to compute random subtitle only once on component mount
  const randomSubtitle = useMemo(() => 
    subtitles[Math.floor(Math.random() * subtitles.length)],
    []
  );

  // Optimized animation detection with error handling
  let animationConfig;
  try {
    animationConfig = useAnimationConfig();
  } catch (error) {
    console.error('Error getting animation config:', error);
    animationConfig = { shouldAnimate: false, duration: 0, stagger: 0, ease: 'linear' };
  }

  const animationVariants = useMemo(() => 
    createAnimationVariants(animationConfig), 
    [animationConfig]
  );

  const { latitude, longitude, loading: geoLoading } = useGeolocation({ autoRequest: false });
  
  // Call useListings hook directly at the top level with error handling
  let listingsResult;
  try {
    listingsResult = useListings({ 
      showOnlyActive: true,
      skipInitialFetch: false,
      limit: 8 // Limit initial load to 8 listings to reduce Firebase usage
    });
  } catch (error) {
    console.error('Error calling useListings hook:', error);
    listingsResult = { listings: [], isLoading: false, error: 'Failed to load listings' };
  }

  const allListings = listingsResult?.listings || [];
  const isLoading = listingsResult?.isLoading || false;
  const listingsError = listingsResult?.error || null;
  
  const router = useRouter();
  const currentGame = router.query.game as string | undefined;

  // Simplified initialization effect
  useEffect(() => {
    if (hasInitialized) return;
    
    const initializeApp = async () => {
      try {
        if (typeof window !== 'undefined') {
          // Clear stale auth data
          try {
            const staleDataFound = checkAndClearStaleAuthData();
            if (staleDataFound) {
              console.log('Stale authentication data was found and cleared');
            }
          } catch (authError) {
            console.error('Error clearing stale auth data:', authError);
          }
          
          // Clear stale cache
          try {
            const hasCleared = sessionStorage.getItem('cache_cleared');
            if (!hasCleared) {
              console.log('Performing initial cache check and cleanup');
              
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('listings_')) {
                  localStorage.removeItem(key);
                }
              });
              
              sessionStorage.setItem('cache_cleared', 'true');
              setCacheCleared(true);
            }
          } catch (cacheError) {
            console.error('Error during initial cache cleanup:', cacheError);
          }
        }
        
        setHasInitialized(true);
      } catch (error) {
        console.error('Error during app initialization:', error);
        setHasInitialized(true); // Still mark as initialized to prevent infinite loops
      }
    };

    initializeApp();
  }, [hasInitialized]);
  
  // Monitor for listing errors
  useEffect(() => {
    if (listingsError) {
      console.error('Listings error detected:', listingsError);
      setConnectionError(true);
    }
  }, [listingsError]);
  
  // Memoize the processed listings to prioritize newest listings
  const processedListings = useMemo(() => {
    if (isLoading || allListings.length === 0) {
      return [];
    }

    try {
      // Add distance information to listings
      const withDistance = allListings.map(listing => {
        const listingLat = listing.coordinates?.latitude;
        const listingLng = listing.coordinates?.longitude;
        const distance = (latitude && longitude && listingLat && listingLng)
          ? calculateDistance(latitude, longitude, listingLat, listingLng)
          : Infinity;
        
        // Add proximity category
        let proximity = 'far';
        if (distance <= 5) proximity = 'very-close';
        else if (distance <= 15) proximity = 'close';
        else if (distance <= 30) proximity = 'medium';
        
        return { ...listing, distance, proximity };
      });
      
      // Sort listings by newest first (creation date descending)
      // This prioritizes showcasing the newest listings on the homepage
      return [...withDistance].sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime; // Newest first
      });
    } catch (error) {
      console.error('Error processing listings:', error);
      return allListings; // Return unprocessed listings as fallback
    }
  }, [allListings, isLoading, latitude, longitude]);

  // Trending searches hook with error handling
  let recordSearch;
  try {
    const trendingSearches = useTrendingSearches();
    recordSearch = trendingSearches.recordSearch;
  } catch (error) {
    console.error('Error getting trending searches hook:', error);
    recordSearch = async () => {}; // No-op fallback
  }

  // Handle category selection
  const handleCategoryClick = useCallback((category?: GameCategory) => {
    const query = category 
      ? { game: category === "Magic: The Gathering" 
          ? "mtg" 
          : GAME_MAPPING[category as keyof typeof GAME_MAPPING] || 
            OTHER_GAME_MAPPING[category as keyof typeof OTHER_GAME_MAPPING] } 
      : {}
    
    router.push({
      pathname: "/listings",
      query,
    })
  }, [router]);

  // Memoize the search handler to prevent recreation on each render
  const handleSearch = useCallback(async () => {
    try {
      // Only record search term if there is one
      if (searchQuery.trim()) {
        try {
          console.log('Recording search term from home page:', searchQuery.trim());
          await recordSearch(searchQuery.trim());
        } catch (error) {
          console.error('Error recording search:', error);
          // Continue with search regardless of recording error
        }
      }

      // Create query object
      const queryParams: Record<string, string> = {};
      
      // Only add parameters that have values
      if (searchQuery.trim()) {
        queryParams.query = searchQuery;
      }
      
      // Add location filter if a specific state is selected
      if (selectedState && selectedState !== "all") {
        queryParams.state = selectedState;
      }

      // Only proceed with navigation if we have at least one filter parameter
      if (Object.keys(queryParams).length > 0) {
        router.push({
          pathname: '/listings',
          query: queryParams,
        });
      } else {
        router.push('/listings');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('An error occurred while processing your search. Please try again.');
    }
  }, [searchQuery, selectedState, router, recordSearch]);

  // On mount, set searchQuery from router.query if present
  useEffect(() => {
    if (router && typeof router.query?.query === "string") {
      setSearchQuery(router.query.query);
    }
  }, [router.query?.query]);

  // Handle search from SearchBar component
  const handleSearchFromBar = useCallback((query: string) => {
    setSearchQuery(query);

    if (query.trim()) {
      try {
        console.log('Recording search term:', query.trim());
        recordSearch(query.trim()).catch(error => {
          console.error('Error recording search:', error);
        });
      } catch (error) {
        console.error('Error recording search:', error);
      }
    }
    
    const queryParams: Record<string, string> = {};
    
    if (query.trim()) {
      queryParams.query = query;
    }
    
    if (selectedState && selectedState !== "all") {
      queryParams.state = selectedState;
    }

    if (Object.keys(queryParams).length > 0) {
      router.push({
        pathname: '/listings',
        query: queryParams,
      });
    } else {
      router.push('/listings');
    }
  }, [selectedState, router, recordSearch]);

  // Handle card selection
  const handleCardSelect = useCallback((cardName: string) => {
    setSearchQuery(cardName);
    setTimeout(() => handleSearch(), 0);
  }, [handleSearch]);

  const { shouldAnimate } = animationConfig;

  return (
    <ErrorBoundary>
      <Head>
        <title>Waboku.gg - Local Trading Card Game Marketplace</title>
        <meta
          name="description"
          content="Buy, sell, and trade TCG cards locally with confidence"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="dns-prefetch" href="//firestore.googleapis.com" />
        <link rel="dns-prefetch" href="//firebase.googleapis.com" />
      </Head>

      <div className="bg-background min-h-screen flex flex-col">
        <ErrorBoundary fallback={<div className="h-16 bg-background" />}>
          <Header />
        </ErrorBoundary>
        
        <main className="flex-1">
          <div className="container mx-auto px-4 py-0 sm:py-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Sidebar */}
              <div className="lg:w-80 flex-shrink-0">
                <div className="sticky top-8 space-y-6">


                  {/* Game Categories */}
                  <motion.div
                    className="hidden lg:block"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Browse Categories</h3>
                        <SidebarGameCategories 
                          onCategoryClick={handleCategoryClick}
                          currentGame={currentGame}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Location Info */}
                  {latitude && longitude && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                    >
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>Showing listings near you</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {/* Hero Section */}
                <div className="relative overflow-hidden mb-4 sm:mb-12 sm:rounded-2xl">
                  <ErrorBoundary fallback={<div className="absolute inset-0 bg-background hidden sm:block" />}>
                    <OptimizedMotion 
                      className="hero-background absolute inset-0 hidden sm:block"
                      variants={animationVariants.heroBackground}
                      initial="hidden"
                      animate="visible"
                      shouldAnimate={shouldAnimate}
                      style={{ willChange: "transform, opacity" }}
                    >
                      <StaticBackground className="opacity-30 rounded-2xl" />
                    </OptimizedMotion>
                  </ErrorBoundary>
                  
                  <div className="relative px-2 py-0 sm:px-8 sm:py-16 sm:text-center">
                    <OptimizedMotion
                      className="max-w-3xl mx-auto space-y-6"
                      variants={animationVariants.container}
                      initial="hidden"
                      animate="visible"
                      shouldAnimate={shouldAnimate}
                    >
                      {/* Desktop Title and Subtitle */}
                      <div className="space-y-4 hidden sm:block">
                        <OptimizedMotion
                          className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground"
                          variants={animationVariants.item}
                          shouldAnimate={shouldAnimate}
                        >
                          Your Local TCG Marketplace
                        </OptimizedMotion>
                        
                        <OptimizedMotion
                          className="text-lg md:text-xl text-muted-foreground"
                          variants={animationVariants.item}
                          shouldAnimate={shouldAnimate}
                        >
                          {randomSubtitle}
                        </OptimizedMotion>
                      </div>

                      {/* Search Section */}
                      <OptimizedMotion
                        className="max-w-2xl mx-auto pt-0 sm:pt-6"
                        variants={animationVariants.item}
                        shouldAnimate={shouldAnimate}
                      >
                        {/* Mobile Search Controls - Now handled in header, so hide on mobile */}

                        {/* Desktop Search Controls */}
                        <div className="hidden sm:flex gap-4">
                          <div className="relative w-full">
                            <ErrorBoundary fallback={<div className="h-10 bg-muted rounded" />}>
                              <SearchBar
                                onSelect={handleCardSelect}
                                onSearch={handleSearchFromBar}
                                initialValue={searchQuery}
                                showSearchButton={true}
                              />
                            </ErrorBoundary>
                          </div>
                          <div className="relative w-[200px]">
                            <ErrorBoundary fallback={<div className="h-10 bg-muted rounded" />}>
                              <StateSelect 
                                value={selectedState || "all"} 
                                onValueChange={(value) => setSelectedState(value)}
                              />
                            </ErrorBoundary>
                          </div>
                        </div>

                        {/* Mobile Title and Subtitle with Gradient Background */}
                        <div className="md:hidden mt-4 -mx-4 px-4 pb-6 bg-gradient-to-b from-background/80 via-background/60 to-background/40">
                          {/* Title and Subtitle - No Card Background */}
                          <div className="text-center space-y-2 pt-6 mb-6">
                            <OptimizedMotion
                              className="text-3xl font-bold tracking-tight text-foreground"
                              variants={animationVariants.item}
                              shouldAnimate={shouldAnimate}
                            >
                              Your Local TCG Marketplace
                            </OptimizedMotion>
                            <OptimizedMotion
                              className="text-base text-muted-foreground"
                              variants={animationVariants.item}
                              shouldAnimate={shouldAnimate}
                            >
                              {randomSubtitle}
                            </OptimizedMotion>
                          </div>

                          {/* Mobile Trending Searches - Keep Card */}
                          <LazySection threshold={0.3}>
                            <Card className="bg-card border rounded-lg shadow-sm ring-1 ring-primary/5 dark:ring-primary/10">
                              <CardContent className="p-3">
                                <ErrorBoundary fallback={<div className="h-8 bg-muted rounded" />}>
                                  <TrendingSearches />
                                </ErrorBoundary>
                              </CardContent>
                            </Card>
                          </LazySection>
                        </div>

                        {/* Desktop Trending Searches */}
                        <LazySection className="hidden md:block mt-2 sm:mt-6 rounded-lg p-1 sm:p-2 bg-transparent" threshold={0.3}>
                          <ErrorBoundary fallback={<div className="h-8 bg-muted rounded" />}>
                            <TrendingSearches />
                          </ErrorBoundary>
                        </LazySection>
                      </OptimizedMotion>
                    </OptimizedMotion>
                  </div>
                </div>

                {/* Newest Listings Section */}
                <LazySection 
                  className="relative z-10" 
                  minHeight="400px"
                  data-scroll-target="listings"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="space-y-1">
                      <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                        <Clock className="h-6 w-6" />
                        Newest Listings
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Fresh cards just added to the marketplace
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/listings">
                        <Button variant="outline" size="sm">View All</Button>
                      </Link>
                      {/* Desktop grid density toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:inline-flex"
                        onClick={cycleGridViewMode}
                        aria-label="Toggle grid view mode"
                        title={`View: ${mobileViewMode}`}
                      >
                        {mobileViewMode === 'default' ? (
                          <LayoutGrid className="h-4 w-4" />
                        ) : (
                          <Image className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Mobile grid density toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="sm:hidden"
                        onClick={cycleGridViewMode}
                        aria-label="Toggle mobile view mode"
                        title={`View: ${mobileViewMode}`}
                      >
                        {mobileViewMode === 'default' ? (
                          <LayoutGrid className="h-4 w-4" />
                        ) : mobileViewMode === 'single' ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Image className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="max-w-[1400px] mx-auto">
                    <ErrorBoundary fallback={
                      <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <h3 className="text-lg font-semibold">Unable to load listings</h3>
                        <p className="text-sm text-muted-foreground">Please refresh the page to try again.</p>
                        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
                      </div>
                    }>
                      <FirebaseConnectionHandler>
                        {connectionError ? (
                          <div className="flex flex-col items-center justify-center p-8 space-y-4">
                            <div className="text-center space-y-2">
                              <h3 className="text-lg font-semibold">Connection Issue Detected</h3>
                              <p className="text-sm text-muted-foreground">
                                We're having trouble loading the latest listings. Please try refreshing the page.
                              </p>
                            </div>
                            <Button 
                              onClick={() => window.location.reload()}
                              className="flex items-center gap-2"
                            >
                              Refresh Page
                            </Button>
                          </div>
                        ) : (
                          <ContentLoader 
                            isLoading={isLoading} 
                            loadingMessage="Loading listings..."
                            minHeight="400px"
                            fallback={
                              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {[...Array(8)].map((_, i) => (
                                  <Skeleton key={i} className="h-64 w-full" />
                                ))}
                              </div>
                            }
                          >
                            {processedListings && processedListings.length > 0 ? (
                              <ListingGrid 
                                listings={processedListings} 
                                loading={false}
                                displayCount={displayCount}
                                hasMore={processedListings.length > displayCount}
                                onLoadMore={() => setDisplayCount(prev => prev + 8)}
                                viewMode={mobileViewMode}
                              />
                            ) : !isLoading && (
                              <Card>
                                <CardContent className="p-12 text-center">
                                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                  <h3 className="text-xl font-semibold mb-2">No listings found</h3>
                                  <p className="text-muted-foreground mb-6">
                                    Be the first to list an item in your area!
                                  </p>
                                  <Link href="/dashboard/create-listing">
                                    <Button>Create Your First Listing</Button>
                                  </Link>
                                </CardContent>
                              </Card>
                            )}
                          </ContentLoader>
                        )}
                      </FirebaseConnectionHandler>
                    </ErrorBoundary>
                  </div>
                </LazySection>
              </div>
            </div>
          </div>
        </main>
        
        <ErrorBoundary fallback={<div className="h-16 bg-background" />}>
          <Footer />
        </ErrorBoundary>
        
        {/* Scroll Indicator */}
        <ErrorBoundary fallback={null}>
          <ScrollIndicator />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}