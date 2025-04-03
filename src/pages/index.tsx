import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import { StateSelect } from "@/components/StateSelect";
import SearchBar from "@/components/SearchBar";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { Footer } from "@/components/Footer";
import { getFirestore, collection, query, orderBy, getDocs, limit, where } from 'firebase/firestore';
import { app, db as firebaseDb, connectionManager } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from "next/head";
import Header from "@/components/Header";
import { GameCategories } from "@/components/GameCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { TrendingSearches } from "@/components/TrendingSearches";
import { checkAndClearStaleAuthData } from "@/lib/auth-token-manager";
import AnimatedBackground from "@/components/AnimatedBackground";
import { ContentLoader } from "@/components/ContentLoader";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Star, Check, Filter, X } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const games = [
  { value: "all", label: "All Games" },
  { value: "yugioh", label: "Yu-Gi-Oh!" },
  { value: "pokemon", label: "Pokémon" },
  { value: "mtg", label: "Magic: The Gathering" },
  { value: "onepiece", label: "One Piece" },
  { value: "digimon", label: "Digimon" },
  { value: "flesh", label: "Flesh and Blood" },
  { value: "weiss", label: "Weiss Schwarz" },
];

const conditions = [
  { value: "all", label: "All Conditions" },
  { value: "mint", label: "Mint" },
  { value: "near-mint", label: "Near Mint" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "light-played", label: "Light Played" },
  { value: "played", label: "Played" },
  { value: "poor", label: "Poor" },
];

// US States for location filter
const usStates = [
  { value: "all", label: "All Locations" },
  { value: "al", label: "Alabama" },
  { value: "ak", label: "Alaska" },
  { value: "az", label: "Arizona" },
  { value: "ar", label: "Arkansas" },
  { value: "ca", label: "California" },
  { value: "co", label: "Colorado" },
  { value: "ct", label: "Connecticut" },
  { value: "de", label: "Delaware" },
  { value: "fl", label: "Florida" },
  { value: "ga", label: "Georgia" },
  { value: "hi", label: "Hawaii" },
  { value: "id", label: "Idaho" },
  { value: "il", label: "Illinois" },
  { value: "in", label: "Indiana" },
  { value: "ia", label: "Iowa" },
  { value: "ks", label: "Kansas" },
  { value: "ky", label: "Kentucky" },
  { value: "la", label: "Louisiana" },
  { value: "me", label: "Maine" },
  { value: "md", label: "Maryland" },
  { value: "ma", label: "Massachusetts" },
  { value: "mi", label: "Michigan" },
  { value: "mn", label: "Minnesota" },
  { value: "ms", label: "Mississippi" },
  { value: "mo", label: "Missouri" },
  { value: "mt", label: "Montana" },
  { value: "ne", label: "Nebraska" },
  { value: "nv", label: "Nevada" },
  { value: "nh", label: "New Hampshire" },
  { value: "nj", label: "New Jersey" },
  { value: "nm", label: "New Mexico" },
  { value: "ny", label: "New York" },
  { value: "nc", label: "North Carolina" },
  { value: "nd", label: "North Dakota" },
  { value: "oh", label: "Ohio" },
  { value: "ok", label: "Oklahoma" },
  { value: "or", label: "Oregon" },
  { value: "pa", label: "Pennsylvania" },
  { value: "ri", label: "Rhode Island" },
  { value: "sc", label: "South Carolina" },
  { value: "sd", label: "South Dakota" },
  { value: "tn", label: "Tennessee" },
  { value: "tx", label: "Texas" },
  { value: "ut", label: "Utah" },
  { value: "vt", label: "Vermont" },
  { value: "va", label: "Virginia" },
  { value: "wa", label: "Washington" },
  { value: "wv", label: "West Virginia" },
  { value: "wi", label: "Wisconsin" },
  { value: "wy", label: "Wyoming" }
];

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

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1]
    }
  }
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedGame, setSelectedGame] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 50000]);
  const [stateOpen, setStateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [randomSubtitle] = useState(() => 
    subtitles[Math.floor(Math.random() * subtitles.length)]
  );
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(8);

  const { latitude, longitude, loading: geoLoading } = useGeolocation();

  useEffect(() => {
    // Check for and clear stale auth data on page load
    // This helps prevent issues with corrupted auth state
    if (typeof window !== 'undefined') {
      const staleDataFound = checkAndClearStaleAuthData();
      if (staleDataFound) {
        console.log('Stale authentication data was found and cleared');
      }
    }
  }, []);

  // Separate useEffect for fetching listings to avoid race conditions
  useEffect(() => {
    // Set a flag in sessionStorage to track if this is the first visit
    const isFirstVisit = sessionStorage.getItem('hasVisitedBefore') !== 'true';
    if (isFirstVisit) {
      sessionStorage.setItem('hasVisitedBefore', 'true');
    }

    // Use sessionStorage to cache listings for a short period
    // This prevents unnecessary Firestore queries on page refreshes or navigation
    const cachedListingsKey = 'homePageListings';
    const cachedListingsTimestampKey = 'homePageListingsTimestamp';
    const cachedListings = sessionStorage.getItem(cachedListingsKey);
    const cachedTimestamp = sessionStorage.getItem(cachedListingsTimestampKey);
    
    // Check if we have valid cached listings (less than 5 minutes old)
    const now = Date.now();
    const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp) : Infinity;
    const cacheValid = cachedListings && cacheAge < 5 * 60 * 1000; // 5 minutes
    
    // Track problematic listing IDs to avoid infinite retries
    const problematicListingIds = new Set<string>([
      'CqxNR6z76xXKon3V3BM1', // Known problematic listing
      'ufKDqtR3DUt2Id2RdLfi'  // Known problematic listing
    ]);
    
    // Add specific listing IDs to debug
    const debugListingIds = new Set<string>([
      'BND7c1ejRRZdlGLSCME' // Listing from screenshot that should be visible
    ]);
    
    // Flag to prevent multiple fetches
    let isFetching = false;
    // Flag to track if component is still mounted
    let isMounted = true;
    
    async function fetchListings() {
      if (typeof window === 'undefined' || isFetching) return;
      
      isFetching = true;
      
      // If we have valid cached listings, use them first for immediate display
      if (cacheValid) {
        try {
          // Parse the cached listings and ensure dates are properly handled
          const rawParsedListings = JSON.parse(cachedListings as string);
          
          // Convert string dates back to Date objects
          const parsedListings = rawParsedListings.map((listing: any) => ({
            ...listing,
            createdAt: listing.createdAt ? new Date(listing.createdAt) : new Date(),
            expiresAt: listing.expiresAt ? new Date(listing.expiresAt) : undefined,
            archivedAt: listing.archivedAt ? new Date(listing.archivedAt) : undefined,
            moderatedAt: listing.moderatedAt ? new Date(listing.moderatedAt) : undefined,
            moderationDetails: listing.moderationDetails ? {
              ...listing.moderationDetails,
              timestamp: listing.moderationDetails.timestamp ? new Date(listing.moderationDetails.timestamp) : undefined
            } : undefined
          })) as Listing[];
          
          console.log('Home page: Using cached listings', parsedListings.length);
          
          // Filter out known problematic listings
          const filteredParsedListings = parsedListings.filter(listing => 
            !problematicListingIds.has(listing.id)
          );
          
          // Process cached listings with location data if available
          if (latitude && longitude) {
            const processedListings = processListingsWithLocation(filteredParsedListings, latitude, longitude);
            if (isMounted) {
              setListings(processedListings);
              setFilteredListings(processedListings);
              setLoading(false);
            }
          } else {
            if (isMounted) {
              setListings(filteredParsedListings);
              setFilteredListings(filteredParsedListings);
              setLoading(false);
            }
          }
          
          // If cache is older than 2 minutes, refresh in background
          if (cacheAge > 2 * 60 * 1000) {
            console.log('Home page: Cache is older than 2 minutes, refreshing in background');
            // Don't set loading state to true for background refresh
            fetchFromFirestore(false);
          }
          
          isFetching = false;
          return;
        } catch (cacheError) {
          console.error('Error parsing cached listings:', cacheError);
          // Continue with normal fetch if cache parsing fails
        }
      }
      
      // No valid cache, fetch from Firestore
      await fetchFromFirestore(true);
      isFetching = false;
    }
    
    // Helper function to process listings with location data
    function processListingsWithLocation(fetchedListings: Listing[], lat: number, lng: number) {
      // First, add distance information to all listings
      const processedListings = fetchedListings.map(listing => {
        const listingLat = listing.coordinates?.latitude;
        const listingLng = listing.coordinates?.longitude;
        const distance = listingLat && listingLng
          ? calculateDistance(lat, lng, listingLat, listingLng)
          : Infinity;
        
        // Add proximity category
        let proximity = 'far';
        if (distance <= 5) proximity = 'very-close';
        else if (distance <= 15) proximity = 'close';
        else if (distance <= 30) proximity = 'medium';
        
        return { ...listing, distance, proximity };
      });
      
      // Then sort them in a single operation
      processedListings.sort((a, b) => {
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
        // Handle both Date objects and string/number timestamps
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 
                     (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 
                     (typeof a.createdAt === 'number' ? a.createdAt : 0));
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 
                     (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 
                     (typeof b.createdAt === 'number' ? b.createdAt : 0));
        return bTime - aTime;
      });
      
      return processedListings;
    }
    
    // Function to fetch listings from Firestore
    async function fetchFromFirestore(showLoading: boolean) {
      try {
        if (showLoading && isMounted) {
          setLoading(true);
        }
        
        console.log('Home page: Fetching listings from Firestore...');
        const db = getFirestore(app);
        
        if (!db) {
          console.error('Firestore database instance is null');
          if (showLoading && isMounted) setLoading(false);
          return;
        }
        
        const q = query(
          collection(db, 'listings'),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(50) // Increased limit to get more listings for better location-based filtering
        );

        console.log('Home page: Executing Firestore query...');
        const querySnapshot = await getDocs(q);
        console.log(`Home page: Query returned ${querySnapshot.docs.length} listings`);
        
        let fetchedListings = querySnapshot.docs
          .map(doc => {
            // Log debug information for specific listings we're tracking
            if (debugListingIds.has(doc.id)) {
              console.log(`Found debug listing: ${doc.id}`, doc.data());
            }
            
            // Skip known problematic listings
            if (problematicListingIds.has(doc.id)) {
              console.log(`Skipping known problematic listing: ${doc.id}`);
              return null;
            }
            
            try {
              const data = doc.data();
              // Ensure createdAt is properly converted to a Date object
              const createdAt = data.createdAt ? 
                (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : 
                (data.createdAt instanceof Date ? data.createdAt : 
                (typeof data.createdAt === 'string' ? new Date(data.createdAt) : 
                (typeof data.createdAt === 'number' ? new Date(data.createdAt) : new Date())))) : new Date();
              
              return {
                id: doc.id,
                ...data,
                createdAt: createdAt,
                title: data.title || 'Untitled Listing',
                price: data.price || 0,
                condition: data.condition || 'Not Specified',
                game: data.game || 'Other',
                imageUrls: data.imageUrls || [],
                status: 'active',
                username: data.username || 'Anonymous',
                userId: data.userId || '',
                city: data.city || '',
                state: data.state || '',
              };
            } catch (error) {
              console.error(`Error processing listing ${doc.id}:`, error);
              // Add to problematic listings set to avoid future processing
              problematicListingIds.add(doc.id);
              return null;
            }
          })
          .filter(Boolean) as Listing[]; // Remove null entries

        // Cache the raw listings in sessionStorage
        try {
          sessionStorage.setItem(cachedListingsKey, JSON.stringify(fetchedListings));
          sessionStorage.setItem(cachedListingsTimestampKey, now.toString());
          console.log('Home page: Cached listings in sessionStorage');
        } catch (cacheError) {
          console.error('Error caching listings:', cacheError);
          // Continue even if caching fails
        }

        // Process all listings at once to avoid multiple re-renders
        if (latitude && longitude) {
          fetchedListings = processListingsWithLocation(fetchedListings, latitude, longitude);
        }

        // Set both state variables at once to avoid multiple renders
        if (isMounted) {
          setListings(fetchedListings);
          setFilteredListings(fetchedListings);
        }
      } catch (error) {
        console.error('Error fetching listings:', error);
        if (isMounted) {
          setListings([]);
          setFilteredListings([]);
        }
      } finally {
        if (showLoading && isMounted) {
          setLoading(false);
        }
      }
    }

    // Fetch listings immediately
    fetchListings();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  const [activeSearchParams, setActiveSearchParams] = useState({
    query: "",
    state: "all",
    game: "all",
    condition: "all",
    priceRange: [0, 1000]
  });

  useEffect(() => {
    let filtered = [...listings];

    // Apply active search parameters
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(listing => 
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
      );
    }

    // Apply game filter
    if (selectedGame !== "all") {
      filtered = filtered.filter(listing => 
        listing.game?.toLowerCase() === selectedGame.toLowerCase()
      );
    }

    // Apply condition filter
    if (selectedCondition !== "all") {
      filtered = filtered.filter(listing => 
        listing.condition?.toLowerCase() === selectedCondition.toLowerCase()
      );
    }

    // Apply location filter
    if (selectedState !== "all") {
      filtered = filtered.filter(listing => 
        listing.state?.toLowerCase() === selectedState.toLowerCase()
      );
    }

    // Apply price filter
    filtered = filtered.filter(listing => 
      listing.price >= priceRange[0] && 
      listing.price <= priceRange[1]
    );

    // Log filtering results for debugging
    console.log(`Filtering results: ${listings.length} total → ${filtered.length} after filters`);
    console.log('Applied filters:', {
      searchQuery: searchQuery || 'none',
      game: selectedGame,
      condition: selectedCondition,
      state: selectedState,
      priceRange
    });

    // If we have specific listings we're looking for, check if they're in the filtered results
    const debugListingIds = ['BND7c1ejRRZdlGLSCME']; // Add specific listing IDs to debug
    for (const debugId of debugListingIds) {
      const inOriginal = listings.some(l => l.id === debugId);
      const inFiltered = filtered.some(l => l.id === debugId);
      
      if (inOriginal && !inFiltered) {
        // Find the listing and log why it was filtered out
        const listing = listings.find(l => l.id === debugId);
        console.log(`Debug listing ${debugId} was filtered out:`, {
          title: listing?.title,
          game: listing?.game,
          condition: listing?.condition,
          state: listing?.state,
          price: listing?.price,
          matchesGameFilter: selectedGame === "all" || listing?.game?.toLowerCase() === selectedGame.toLowerCase(),
          matchesConditionFilter: selectedCondition === "all" || listing?.condition?.toLowerCase() === selectedCondition.toLowerCase(),
          matchesStateFilter: selectedState === "all" || listing?.state?.toLowerCase() === selectedState.toLowerCase(),
          matchesPriceFilter: listing?.price >= priceRange[0] && listing?.price <= priceRange[1]
        });
      } else if (inOriginal && inFiltered) {
        console.log(`Debug listing ${debugId} passed all filters and is visible`);
      }
    }

    setFilteredListings(filtered);
  }, [listings, searchQuery, selectedGame, selectedCondition, selectedState, priceRange]);

  const router = useRouter();

  const handleSearch = () => {
    // Create query object
    const queryParams: any = {};
    
    // Only add parameters that have values
    if (searchQuery) {
      queryParams.query = searchQuery;
    }
    
    if (selectedState !== 'all') {
      queryParams.state = selectedState;
    }
    
    if (selectedGame !== 'all') {
      queryParams.game = selectedGame;
    }
    
    if (selectedCondition !== 'all') {
      queryParams.condition = selectedCondition;
    }
    
    if (priceRange[0] !== 0) {
      queryParams.minPrice = priceRange[0];
    }
    
    if (priceRange[1] !== 50000) {
      queryParams.maxPrice = priceRange[1];
    }
    
    // Redirect to listings page with search parameters
    router.push({
      pathname: '/listings',
      query: queryParams,
    });
  };

  const resetFilters = () => {
    setSelectedGame("all");
    setSelectedCondition("all");
    setPriceRange([0, 50000]);
    setFilterOpen(false);
  };

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
            {/* Original Background Animation - Using placeholder div to prevent layout shift */}
            <div className="hero-background opacity-0"></div>
            <motion.div 
              className="hero-background absolute inset-0"
              variants={heroBackgroundVariants}
              initial="hidden"
              animate="visible"
            />
            
            <div className="relative container mx-auto px-4 py-8 sm:py-10 md:py-12 lg:py-16">
              <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
                <div className="space-y-4 sm:space-y-6">
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
                  <p className="text-base sm:text-lg md:text-xl glow-text-subtle animate-subtitle absolute left-0 right-0">
                    {randomSubtitle}
                  </p>
                </div>

                {/* Search Section */}
                <div className="flex flex-col max-w-2xl mx-auto pt-4 sm:pt-6 pb-4 sm:pb-8 px-4 sm:px-0">
                  {/* Mobile Search Controls */}
                  <div className="flex sm:hidden flex-col gap-4 mb-4 px-2">
                    <div className="relative w-full">
                      <SearchBar
                        onSelect={(cardName) => {
                          setSearchQuery(cardName);
                          handleSearch();
                        }}
                        onSearch={(query) => {
                          setSearchQuery(query);
                          handleSearch();
                        }}
                        initialValue={searchQuery}
                        showSearchButton={true}
                        selectedState={selectedState}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <StateSelect
                          value={selectedState}
                          onValueChange={(state) => setSelectedState(state.toLowerCase())}
                        />
                      </div>
                      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" className="h-12">
                            <Filter className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent>
                          <SheetHeader>
                            <SheetTitle>Filters</SheetTitle>
                            <SheetDescription>
                              Refine your search with additional filters
                            </SheetDescription>
                          </SheetHeader>
                          <div className="py-4 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Category</label>
                              <Select value={selectedGame} onValueChange={setSelectedGame}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {games.map((game) => (
                                    <SelectItem key={game.value} value={game.value}>
                                      {game.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Condition</label>
                              <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                                <SelectContent>
                                  {conditions.map((condition) => (
                                    <SelectItem key={condition.value} value={condition.value}>
                                      {condition.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Price Range</label>
                              <div className="pt-4">
                                <Slider
                                  value={priceRange}
                                  min={0}
                                  max={50000}
                                  step={10}
                                  onValueChange={setPriceRange}
                                />
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex items-center">
                                    <span className="text-sm mr-2">$</span>
                                    <Input
                                      type="number"
                                      value={priceRange[0]}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (value >= 0 && value <= priceRange[1]) {
                                          setPriceRange([value, priceRange[1]]);
                                        }
                                      }}
                                      className="w-24 h-8"
                                      min={0}
                                      max={priceRange[1]}
                                    />
                                  </div>
                                  <span className="text-sm">to</span>
                                  <div className="flex items-center">
                                    <span className="text-sm mr-2">$</span>
                                    <Input
                                      type="number"
                                      value={priceRange[1]}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (value >= priceRange[0] && value <= 50000) {
                                          setPriceRange([priceRange[0], value]);
                                        }
                                      }}
                                      className="w-24 h-8"
                                      min={priceRange[0]}
                                      max={50000}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <SheetFooter>
                            <Button variant="outline" onClick={resetFilters}>Reset</Button>
                            <Button onClick={() => setFilterOpen(false)}>Apply Filters</Button>
                          </SheetFooter>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </div>

                  {/* Desktop Search Controls */}
                  <div className="hidden sm:flex gap-4">
                    <div className="relative flex-1">
                      <SearchBar
                        onSelect={(cardName) => {
                          setSearchQuery(cardName);
                          handleSearch();
                        }}
                        onSearch={(query) => {
                          setSearchQuery(query);
                          handleSearch();
                        }}
                        initialValue={searchQuery}
                        showSearchButton={true}
                        selectedState={selectedState}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="w-[180px]">
                        <StateSelect
                          value={selectedState}
                          onValueChange={(state) => setSelectedState(state.toLowerCase())}
                        />
                      </div>
                      
                      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" className="h-12">
                            <Filter className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Filters</span>
                          </Button>
                        </SheetTrigger>
                        <SheetContent>
                          <SheetHeader>
                            <SheetTitle>Filters</SheetTitle>
                            <SheetDescription>
                              Refine your search with additional filters
                            </SheetDescription>
                          </SheetHeader>
                          <div className="py-4 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Category</label>
                              <Select value={selectedGame} onValueChange={setSelectedGame}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {games.map((game) => (
                                    <SelectItem key={game.value} value={game.value}>
                                      {game.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Condition</label>
                              <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                                <SelectContent>
                                  {conditions.map((condition) => (
                                    <SelectItem key={condition.value} value={condition.value}>
                                      {condition.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Price Range</label>
                              <div className="pt-4">
                                <Slider
                                  value={priceRange}
                                  min={0}
                                  max={50000}
                                  step={10}
                                  onValueChange={setPriceRange}
                                />
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex items-center">
                                    <span className="text-sm mr-2">$</span>
                                    <Input
                                      type="number"
                                      value={priceRange[0]}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (value >= 0 && value <= priceRange[1]) {
                                          setPriceRange([value, priceRange[1]]);
                                        }
                                      }}
                                      className="w-24 h-8"
                                      min={0}
                                      max={priceRange[1]}
                                    />
                                  </div>
                                  <span className="text-sm">to</span>
                                  <div className="flex items-center">
                                    <span className="text-sm mr-2">$</span>
                                    <Input
                                      type="number"
                                      value={priceRange[1]}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (value >= priceRange[0] && value <= 50000) {
                                          setPriceRange([priceRange[0], value]);
                                        }
                                      }}
                                      className="w-24 h-8"
                                      min={priceRange[0]}
                                      max={50000}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <SheetFooter>
                            <Button variant="outline" onClick={resetFilters}>Reset</Button>
                            <Button onClick={() => setFilterOpen(false)}>Apply Filters</Button>
                          </SheetFooter>
                        </SheetContent>
                      </Sheet>
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
            
            {/* Active filters display */}
            {(selectedGame !== "all" || selectedCondition !== "all" || selectedState !== "all" || priceRange[0] > 0 || priceRange[1] < 50000) && (
              <div className="mb-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {selectedGame !== "all" && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Game: {games.find(g => g.value === selectedGame)?.label}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1" 
                      onClick={() => setSelectedGame("all")}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </Badge>
                )}
                {selectedCondition !== "all" && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Condition: {conditions.find(c => c.value === selectedCondition)?.label}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1" 
                      onClick={() => setSelectedCondition("all")}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </Badge>
                )}
                {selectedState !== "all" && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Location: {usStates.find(s => s.value === selectedState)?.label}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1" 
                      onClick={() => setSelectedState("all")}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </Badge>
                )}
                {(priceRange[0] > 0 || priceRange[1] < 50000) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Price: ${priceRange[0]} - ${priceRange[1]}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1" 
                      onClick={() => setPriceRange([0, 50000])}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </Badge>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={resetFilters}
                >
                  Clear All
                </Button>
              </div>
            )}
            <div className="max-w-[1400px] mx-auto">
              <ContentLoader 
                isLoading={loading} 
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
                  listings={filteredListings} 
                  loading={false} // We're handling loading state with ContentLoader
                  displayCount={displayCount}
                  hasMore={filteredListings.length > displayCount}
                  onLoadMore={() => setDisplayCount(prev => prev + 8)}
                />
              </ContentLoader>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}