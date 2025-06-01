import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRouter } from "next/router";
import SearchBar from "@/components/SearchBar";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { Footer } from "@/components/Footer";
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from "next/head";
import Header from "@/components/Header";
import { GameCategories } from "@/components/GameCategories";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { TrendingSearches } from "@/components/TrendingSearches";
import { checkAndClearStaleAuthData } from "@/lib/auth-token-manager";
import AnimatedBackground from "@/components/AnimatedBackground";
import { ContentLoader } from "@/components/ContentLoader";
import { useListings } from "@/hooks/useListings";
import { useTrendingSearches } from "@/hooks/useTrendingSearches";
import Link from "next/link";
import { FirebaseConnectionHandler } from "@/components/FirebaseConnectionHandler";
import { fixFirestoreListenChannel, clearFirestoreCaches } from "@/lib/firebase-connection-fix";
import { StateSelect } from "@/components/StateSelect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRef } from "react";

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

// Optimized animation variants with mobile considerations
const createAnimationVariants = (isMobile: boolean, prefersReducedMotion: boolean) => {
  // If user prefers reduced motion or on mobile, use minimal animations
  if (prefersReducedMotion || isMobile) {
    return {
      container: {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.2, ease: "easeOut" }
        }
      },
      heroBackground: {
        hidden: { opacity: 0 },
        visible: { 
          opacity: 1,
          transition: { duration: 0.3, ease: "easeOut" }
        }
      },
      item: {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.15, ease: "easeOut" }
        }
      }
    };
  }

  // Full animations for desktop users who don't prefer reduced motion
  return {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.1,
          delayChildren: 0.3,
          duration: 0.6,
          ease: [0.23, 1, 0.32, 1]
        }
      }
    },
    heroBackground: {
      hidden: { 
        opacity: 0,
        scale: 1.1
      },
      visible: { 
        opacity: 1,
        scale: 1,
        transition: {
          duration: 1.2,
          ease: [0.23, 1, 0.32, 1]
        }
      }
    },
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          type: "spring",
          damping: 12,
          stiffness: 100
        }
      }
    }
  };
};

// Optimized Motion Component that respects user preferences
const OptimizedMotion = ({ 
  children, 
  variants, 
  initial = "hidden", 
  animate = "visible",
  className,
  style,
  ...props 
}: any) => {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // Skip animations entirely for reduced motion or low-end mobile
  if (prefersReducedMotion) {
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

// Lazy-loaded components with intersection observer
const LazySection = ({ children, className, threshold = 0.1 }: any) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { 
    once: true, 
    threshold,
    margin: "50px 0px" // Start loading 50px before entering viewport
  });
  
  return (
    <div ref={ref} className={className}>
      {isInView ? children : <div style={{ minHeight: "200px" }} />}
    </div>
  );
};

export default function OptimizedFrontPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("all");
  
  // Use useMemo to compute random subtitle only once on component mount
  const randomSubtitle = useMemo(() => 
    subtitles[Math.floor(Math.random() * subtitles.length)],
    []
  );
  
  const [displayCount, setDisplayCount] = useState(8);
  const [connectionError, setConnectionError] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  // Device and preference detection
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isLowEndDevice = useMediaQuery("(max-width: 480px)");
  const prefersReducedMotion = useReducedMotion();

  // Memoize animation variants based on device capabilities
  const animationVariants = useMemo(() => 
    createAnimationVariants(isMobile || isLowEndDevice, prefersReducedMotion),
    [isMobile, isLowEndDevice, prefersReducedMotion]
  );

  const { latitude, longitude, loading: geoLoading } = useGeolocation({ autoRequest: false });
  const { listings: allListings, isLoading, error: listingsError } = useListings();
  const router = useRouter();

  // Optimized initialization effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const initializeApp = async () => {
      // Check for stale auth data
      const staleDataFound = checkAndClearStaleAuthData();
      if (staleDataFound) {
        console.log('Stale authentication data was found and cleared');
      }
      
      // Clear cache only once per session
      const hasCleared = sessionStorage.getItem('cache_cleared');
      if (!hasCleared) {
        console.log('Performing initial cache check and cleanup');
        
        // Clear all listing-related localStorage items
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('listings_')) {
            localStorage.removeItem(key);
          }
        });
        
        sessionStorage.setItem('cache_cleared', 'true');
        setCacheCleared(true);
      }
    };
    
    // Use requestIdleCallback for non-critical initialization
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initializeApp);
    } else {
      setTimeout(initializeApp, 0);
    }
    
    // Global error handler for Firestore fetch errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && 
          (event.reason.message === 'Failed to fetch' || 
           (event.reason.stack && event.reason.stack.includes('firestore.googleapis.com')))) {
        console.error('Detected Firestore fetch error on home page:', event.reason);
        setConnectionError(true);
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Monitor for listing errors
  useEffect(() => {
    if (listingsError) {
      console.error('Listings error detected:', listingsError);
      setConnectionError(true);
    }
  }, [listingsError]);
  
  // Memoize processed listings with optimized sorting
  const processedListings = useMemo(() => {
    if (isLoading || allListings.length === 0) {
      return [];
    }

    // Batch process listings for better performance
    const withDistance = allListings.map(listing => {
      const listingLat = listing.coordinates?.latitude;
      const listingLng = listing.coordinates?.longitude;
      const distance = (latitude && longitude && listingLat && listingLng)
        ? calculateDistance(latitude, longitude, listingLat, listingLng)
        : Infinity;
      
      let proximity = 'far';
      if (distance <= 5) proximity = 'very-close';
      else if (distance <= 15) proximity = 'close';
      else if (distance <= 30) proximity = 'medium';
      
      return { ...listing, distance, proximity };
    });
    
    // Optimized sorting algorithm
    if (latitude && longitude) {
      return withDistance.sort((a, b) => {
        const aWithin50 = (a.distance || Infinity) <= 50;
        const bWithin50 = (b.distance || Infinity) <= 50;
        
        if (aWithin50 && !bWithin50) return -1;
        if (!aWithin50 && bWithin50) return 1;
        
        if (aWithin50 && bWithin50) {
          return (a.distance || Infinity) - (b.distance || Infinity);
        }
        
        // Use cached timestamps for better performance
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
    }
    
    return withDistance;
  }, [allListings, isLoading, latitude, longitude]);

  const { recordSearch } = useTrendingSearches();

  // Optimized search handler with debouncing
  const handleSearch = useCallback(async () => {
    try {
      if (searchQuery.trim()) {
        // Use requestIdleCallback for non-critical search recording
        const recordSearchAsync = () => {
          recordSearch(searchQuery.trim()).catch(error => {
            console.error('Error recording search:', error);
          });
        };
        
        if ('requestIdleCallback' in window) {
          requestIdleCallback(recordSearchAsync);
        } else {
          setTimeout(recordSearchAsync, 0);
        }
      }

      const queryParams: Record<string, string> = {};
      
      if (searchQuery.trim()) {
        queryParams.query = searchQuery;
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
    } catch (error) {
      console.error('Search error:', error);
      alert('An error occurred while processing your search. Please try again.');
    }
  }, [searchQuery, selectedState, router, recordSearch]);

  // Optimized search from bar handler
  const handleSearchFromBar = useCallback((query: string) => {
    if (query.trim()) {
      // Non-blocking search recording
      const recordSearchAsync = () => {
        recordSearch(query.trim()).catch(error => {
          console.error('Error recording search:', error);
        });
      };
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(recordSearchAsync);
      } else {
        setTimeout(recordSearchAsync, 0);
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

  // Optimized card selection handler
  const handleCardSelect = useCallback((cardName: string) => {
    setSearchQuery(cardName);
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => handleSearch());
  }, [handleSearch]);

  return (
    <>
      <Head>
        <title>Waboku.gg - Local Trading Card Game Marketplace</title>
        <meta
          name="description"
          content="Buy, sell, and trade TCG cards locally with confidence"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="" />
      </Head>

      <div className="bg-background min-h-screen flex flex-col">
        <Header animate={!prefersReducedMotion} />
        <main className="flex-1">
          {/* Game Categories - Lazy loaded */}
          <LazySection>
            <GameCategories />
          </LazySection>

          {/* Hero Section with optimized animations */}
          <div className="relative overflow-hidden min-h-screen">
            {/* Optimized Background Animation */}
            <OptimizedMotion 
              className="hero-background absolute inset-0"
              variants={animationVariants.heroBackground}
              initial="hidden"
              animate="visible"
              style={{ willChange: "transform, opacity" }}
            >
              <AnimatedBackground className="opacity-80" />
            </OptimizedMotion>
            
            <div className="relative container mx-auto px-4 py-8 sm:py-10 md:py-12 lg:py-16">
              <OptimizedMotion
                className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6"
                variants={animationVariants.container}
                initial="hidden"
                animate="visible"
              >
                <div className="space-y-2 sm:space-y-3">
                  {/* Optimized title with layout preservation */}
                  <div className="relative">
                    <div className="invisible h-[3.75rem] sm:h-[4.5rem] md:h-[6rem] lg:h-[7.5rem]" aria-hidden="true">
                      Your Local TCG Marketplace
                    </div>
                    <OptimizedMotion
                      className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight glow-text animate-title absolute left-0 right-0 top-0"
                      variants={animationVariants.item}
                      style={{ willChange: "transform, opacity" }}
                    >
                      Your Local TCG Marketplace
                    </OptimizedMotion>
                  </div>
                  
                  <div className="relative">
                    <div className="invisible h-[1.5rem] sm:h-[1.75rem] md:h-[2rem]" aria-hidden="true">
                      {randomSubtitle}
                    </div>
                    <OptimizedMotion
                      className="text-base sm:text-lg md:text-xl glow-text-subtle animate-subtitle absolute left-0 right-0 top-0"
                      variants={animationVariants.item}
                      style={{ willChange: "transform, opacity" }}
                    >
                      {randomSubtitle}
                    </OptimizedMotion>
                  </div>
                </div>

                {/* Search Section with lazy loading */}
                <OptimizedMotion
                  className="flex flex-col max-w-2xl mx-auto pt-4 sm:pt-6 pb-4 sm:pb-8 px-4 sm:px-0"
                  variants={animationVariants.item}
                >
                  {/* Mobile Search Controls */}
                  <div className="flex sm:hidden flex-col gap-4 mb-4 px-2">
                    <div className="relative w-full">
                      <SearchBar
                        onSelect={handleCardSelect}
                        onSearch={handleSearchFromBar}
                        initialValue={searchQuery}
                        showSearchButton={true}
                      />
                    </div>
                    <div className="relative w-full">
                      <StateSelect 
                        value={selectedState || "all"} 
                        onValueChange={(value) => setSelectedState(value)}
                      />
                    </div>
                  </div>

                  {/* Desktop Search Controls */}
                  <div className="hidden sm:flex gap-4">
                    <div className="relative w-full">
                      <SearchBar
                        onSelect={handleCardSelect}
                        onSearch={handleSearchFromBar}
                        initialValue={searchQuery}
                        showSearchButton={true}
                      />
                    </div>
                    <div className="relative w-[200px]">
                      <StateSelect 
                        value={selectedState || "all"} 
                        onValueChange={(value) => setSelectedState(value)}
                      />
                    </div>
                  </div>

                  {/* Trending Searches - Lazy loaded */}
                  <LazySection className="mt-4 rounded-lg p-2 bg-transparent" threshold={0.3}>
                    <TrendingSearches />
                  </LazySection>
                </OptimizedMotion>
              </OptimizedMotion>
            </div>
          </div>

          {/* Listings Section - Lazy loaded with intersection observer */}
          <LazySection className="container mx-auto px-4 py-8 sm:py-12 relative z-10 bg-background mt-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-foreground">
                {latitude && longitude ? "Latest Listings Near You" : "Latest Listings"}
              </h2>
              <Link href="/listings">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
            
            <div className="max-w-[1400px] mx-auto">
              <FirebaseConnectionHandler>
                {connectionError ? (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Connection Issue Detected</h3>
                      <p className="text-sm text-muted-foreground">
                        We're having trouble loading the latest listings. This might be due to a temporary connection issue.
                      </p>
                    </div>
                    <Button 
                      onClick={async () => {
                        setIsRecovering(true);
                        try {
                          await clearFirestoreCaches();
                          console.log('Cleared all Firestore caches');
                          
                          Object.keys(localStorage).forEach(key => {
                            if (key.startsWith('listings_')) {
                              localStorage.removeItem(key);
                            }
                          });
                          
                          await fixFirestoreListenChannel();
                          console.log('Fixed Firestore Listen channel');
                          
                          setConnectionError(false);
                          window.location.reload();
                        } catch (error) {
                          console.error('Error recovering connection:', error);
                          alert('Unable to automatically fix the connection. Please try refreshing the page manually.');
                        } finally {
                          setIsRecovering(false);
                        }
                      }}
                      disabled={isRecovering}
                      className="flex items-center gap-2"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Fixing Connection...
                        </>
                      ) : (
                        <>Fix Connection</>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.reload()}
                      className="mt-2"
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
                    <ListingGrid 
                      listings={processedListings} 
                      loading={false}
                      displayCount={displayCount}
                      hasMore={processedListings.length > displayCount}
                      onLoadMore={() => setDisplayCount(prev => prev + 8)}
                    />
                  </ContentLoader>
                )}
              </FirebaseConnectionHandler>
            </div>
          </LazySection>
        </main>
        <Footer />
      </div>
    </>
  );
}