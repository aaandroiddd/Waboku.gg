import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
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
import { TrendingSearches } from "@/components/TrendingSearches";
import { checkAndClearStaleAuthData } from "@/lib/auth-token-manager";
import AnimatedBackground from "@/components/AnimatedBackground";
import { ContentLoader } from "@/components/ContentLoader";
import { useListings } from "@/hooks/useListings";
import Link from "next/link";
import { FirebaseConnectionHandler } from "@/components/FirebaseConnectionHandler";
import { StateSelect } from "@/components/StateSelect";

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

// Animation variants - moved outside component to prevent recreation on each render
const containerVariants = {
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
};

const heroBackgroundVariants = {
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
};

const itemVariants = {
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
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("all");
  // Use useMemo to compute random subtitle only once on component mount
  const randomSubtitle = useMemo(() => 
    subtitles[Math.floor(Math.random() * subtitles.length)],
    []
  );
  const [displayCount, setDisplayCount] = useState(8);

  const { latitude, longitude, loading: geoLoading } = useGeolocation({ autoRequest: false });
  const { listings: allListings, isLoading } = useListings();
  const router = useRouter();

  // Check for stale auth data only once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const staleDataFound = checkAndClearStaleAuthData();
      if (staleDataFound) {
        console.log('Stale authentication data was found and cleared');
      }
    }
  }, []);
  
  // Memoize the processed listings to avoid recalculation on every render
  const processedListings = useMemo(() => {
    if (isLoading || allListings.length === 0) {
      return [];
    }

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
    
    // Sort listings by distance if location is available
    if (latitude && longitude) {
      return [...withDistance].sort((a, b) => {
        // Prioritize listings within 50km
        const aWithin50 = (a.distance || Infinity) <= 50;
        const bWithin50 = (b.distance || Infinity) <= 50;
        
        if (aWithin50 && !bWithin50) return -1;
        if (!aWithin50 && bWithin50) return 1;
        
        // For listings within 50km, sort by distance
        if (aWithin50 && bWithin50) {
          return (a.distance || Infinity) - (b.distance || Infinity);
        }
        
        // For listings beyond 50km, sort by recency
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
    }
    
    return withDistance;
  }, [allListings, isLoading, latitude, longitude]);

  // Memoize the search handler to prevent recreation on each render
  const handleSearch = useCallback(async () => {
    try {
      // Only record search term if there is one
      if (searchQuery.trim()) {
        const response = await fetch('/api/search/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ searchTerm: searchQuery }),
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 429) {
            // Rate limit exceeded
            alert('Please wait a moment before searching again.');
            return;
          } else if (response.status === 400) {
            // Invalid or inappropriate search term
            alert('Invalid or inappropriate search term.');
            return;
          }
          throw new Error(data.error || 'Failed to process search');
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
      // This ensures we can filter by state even when search query is empty
      if (Object.keys(queryParams).length > 0) {
        // Update URL with search parameters
        router.push({
          pathname: '/listings',
          query: queryParams,
        });
      } else {
        // If no filters are applied, just go to the listings page
        router.push('/listings');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('An error occurred while processing your search. Please try again.');
    }
  }, [searchQuery, selectedState, router]);

  // Handle search from SearchBar component
  const handleSearchFromBar = useCallback((query: string) => {
    // Create query object
    const queryParams: Record<string, string> = {};
    
    // Only add parameters that have values
    if (query.trim()) {
      queryParams.query = query;
    }
    
    // Add location filter if a specific state is selected
    if (selectedState && selectedState !== "all") {
      queryParams.state = selectedState;
    }

    // Navigate to listings page with search parameters
    if (Object.keys(queryParams).length > 0) {
      router.push({
        pathname: '/listings',
        query: queryParams,
      });
    } else {
      // If no filters are applied, just go to the listings page
      router.push('/listings');
    }
  }, [selectedState, router]);

  // Handle card selection
  const handleCardSelect = useCallback((cardName: string) => {
    setSearchQuery(cardName);
    // Use setTimeout to ensure state is updated before search
    setTimeout(() => handleSearch(), 0);
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
      </Head>

      <div className="bg-background min-h-screen flex flex-col">
        <Header animate={true} />
        <main className="flex-1">
          {/* Game Categories */}
          <GameCategories />

          {/* Hero Section */}
          <div className="relative overflow-hidden min-h-screen">
            {/* Optimized Background Animation with performance improvements */}
            <div className="hero-background opacity-0"></div>
            <motion.div 
              className="hero-background absolute inset-0"
              variants={heroBackgroundVariants}
              initial="hidden"
              animate="visible"
            >
              <AnimatedBackground className="opacity-80" />
            </motion.div>
            
            <div className="relative container mx-auto px-4 py-8 sm:py-10 md:py-12 lg:py-16">
              <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  {/* Using placeholder divs with the same dimensions to prevent layout shift */}
                  <div className="invisible h-[3.75rem] sm:h-[4.5rem] md:h-[6rem] lg:h-[7.5rem]" aria-hidden="true">
                    Your Local TCG Marketplace
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight glow-text animate-title absolute left-0 right-0">
                    Your Local TCG Marketplace
                  </h1>
                  
                  <div className="invisible h-[1.5rem] sm:h-[1.75rem] md:h-[2rem]" aria-hidden="true">
                    {randomSubtitle}
                  </div>
                  <p className="text-base sm:text-lg md:text-xl glow-text-subtle animate-subtitle absolute left-0 right-0 mt-1 sm:mt-0">
                    {randomSubtitle}
                  </p>
                </div>

                {/* Search Section */}
                <div className="flex flex-col max-w-2xl mx-auto pt-4 sm:pt-6 pb-4 sm:pb-8 px-4 sm:px-0">
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
                    {/* Mobile Location Dropdown */}
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
                    {/* Desktop Location Dropdown */}
                    <div className="relative w-[200px]">
                      <StateSelect 
                        value={selectedState || "all"} 
                        onValueChange={(value) => setSelectedState(value)}
                      />
                    </div>
                  </div>

                  {/* Trending Searches */}
                  <div className="mt-4 rounded-lg p-2 bg-transparent">
                    <TrendingSearches />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Listings Section */}
          <section className="container mx-auto px-4 py-8 sm:py-12 relative z-10 bg-background mt-0">
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
                    loading={false} // We're handling loading state with ContentLoader
                    displayCount={displayCount}
                    hasMore={processedListings.length > displayCount}
                    onLoadMore={() => setDisplayCount(prev => prev + 8)}
                  />
                </ContentLoader>
              </FirebaseConnectionHandler>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}