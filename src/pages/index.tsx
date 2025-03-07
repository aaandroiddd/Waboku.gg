import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { StateSelect } from "@/components/StateSelect";
import SearchBar from "@/components/SearchBar";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { Footer } from "@/components/Footer";
import { getFirestore, collection, query, orderBy, getDocs, limit, where } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from "next/head";
import Header from "@/components/Header";
import { GameCategories } from "@/components/GameCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { TrendingSearches } from "@/components/TrendingSearches";
import { checkAndClearStaleAuthData } from "@/lib/auth-token-manager";
import AnimatedBackground from "@/components/AnimatedBackground";
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
import { Search, MapPin, Star, Check, Filter } from "lucide-react";
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
  "Join the growing card game community.",
  "Buy, sell, and trade cards with collectors in your area.",
  "Trust us, you don't have enough lands.",
  "You need that next alt-art, don't listen to your wife.",
  "Home of the secret rares."
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
  const [priceRange, setPriceRange] = useState([0, 1000]);
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

    async function fetchListings() {
      if (typeof window === 'undefined') return;
      
      try {
        setLoading(true);
        const db = getFirestore(app);
        const q = query(
          collection(db, 'listings'),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(50) // Increased limit to get more listings for better location-based filtering
        );

        const querySnapshot = await getDocs(q);
        let fetchedListings = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
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
          }) as Listing[];

        if (latitude && longitude) {
          // Calculate distances and add proximity categories
          fetchedListings = fetchedListings
            .map(listing => {
              const listingLat = listing.coordinates?.latitude;
              const listingLng = listing.coordinates?.longitude;
              const distance = listingLat && listingLng
                ? calculateDistance(latitude, longitude, listingLat, listingLng)
                : Infinity;
              
              // Add proximity category
              let proximity = 'far';
              if (distance <= 5) proximity = 'very-close';
              else if (distance <= 15) proximity = 'close';
              else if (distance <= 30) proximity = 'medium';
              
              return { ...listing, distance, proximity };
            })
            .sort((a, b) => {
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
              return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
            });
        }

        setListings(fetchedListings);
        setFilteredListings(fetchedListings);
      } catch (error) {
        console.error('Error fetching listings:', error);
        setListings([]);
        setFilteredListings([]);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
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

    setFilteredListings(filtered);
  }, [listings, searchQuery, selectedGame, selectedCondition, selectedState, priceRange]);

  const router = useRouter();

  const handleSearch = () => {
    // Redirect to listings page with search parameters
    router.push({
      pathname: '/listings',
      query: {
        ...(searchQuery && { query: searchQuery }),
        ...(selectedState !== 'all' && { state: selectedState }),
        ...(selectedGame !== 'all' && { game: selectedGame }),
        ...(selectedCondition !== 'all' && { condition: selectedCondition }),
        ...(priceRange[0] !== 0 && { minPrice: priceRange[0] }),
        ...(priceRange[1] !== 1000 && { maxPrice: priceRange[1] }),
      },
    });
  };

  const resetFilters = () => {
    setSelectedGame("all");
    setSelectedCondition("all");
    setPriceRange([0, 1000]);
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
        <Header />
        <main className="flex-1">
          {/* Game Categories */}
          <GameCategories />

          {/* Hero Section */}
          <div className="relative overflow-hidden">
            {/* Animated Background */}
            <div className="hero-background animated-bg">
              <div className="animated-bg-overlay"></div>
            </div>
            <AnimatedBackground className="absolute inset-0" />
            
            <div className="relative container mx-auto px-4 py-16 sm:py-20 md:py-24 lg:py-32">
              <div className="text-center max-w-3xl mx-auto space-y-6 sm:space-y-8">
                <div className="space-y-4 sm:space-y-6 pt-8 sm:pt-12 md:pt-16">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight glow-text animate-title">
                    Your Local TCG Marketplace
                  </h1>
                  <p className="text-base sm:text-lg md:text-xl glow-text-subtle animate-subtitle">
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
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <StateSelect
                          value={selectedState}
                          onValueChange={(state) => setSelectedState(state.toLowerCase())}
                        />
                      </div>
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
                      />
                    </div>
                    
                    <div className="flex">
                      <div className="w-[180px]">
                        <StateSelect
                          value={selectedState}
                          onValueChange={(state) => setSelectedState(state.toLowerCase())}
                        />
                      </div>
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
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold text-foreground">
                {latitude && longitude ? "Latest Listings Near You" : "Latest Listings"}
              </h2>
              <Link href="/listings">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
            <div className="max-w-[1400px] mx-auto">
              <ListingGrid 
                listings={filteredListings} 
                loading={loading} 
                displayCount={displayCount}
                hasMore={filteredListings.length > displayCount}
                onLoadMore={() => setDisplayCount(prev => prev + 8)}
              />
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}