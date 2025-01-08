import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import { StateSelect } from "@/components/StateSelect";
import SearchBar from "@/components/SearchBar";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { Footer } from "@/components/Footer";
import { getFirestore, collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from "next/head";
import Header from "@/components/Header";
import { GameCategories } from "@/components/GameCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(8);

  const { latitude, longitude, loading: geoLoading } = useGeolocation();

  useEffect(() => {
    async function fetchListings() {
      if (typeof window === 'undefined') return;
      
      try {
        setLoading(true);
        const db = getFirestore(app);
        const q = query(
          collection(db, 'listings'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );

        const querySnapshot = await getDocs(q);
        let fetchedListings = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              // Ensure required fields have default values
              title: data.title || 'Untitled Listing',
              price: data.price || 0,
              condition: data.condition || 'Not Specified',
              game: data.game || 'Other',
              imageUrls: data.imageUrls || [],
              status: data.status || 'active',
              username: data.username || 'Anonymous',
              userId: data.userId || '',
              city: data.city || '',
              state: data.state || '',
            };
          })
          .filter(listing => listing.status === 'active') as Listing[];

        if (latitude && longitude) {
          fetchedListings = fetchedListings
            .map(listing => {
              const listingLat = listing.coordinates?.latitude;
              const listingLng = listing.coordinates?.longitude;
              const distance = listingLat && listingLng
                ? calculateDistance(latitude, longitude, listingLat, listingLng)
                : Infinity;
              return { ...listing, distance };
            })
            .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        }

        // Add some sample listings if no listings are found (for development)
        if (fetchedListings.length === 0) {
          fetchedListings = [
            {
              id: '1',
              title: 'Sample Card Listing',
              price: 29.99,
              condition: 'Near Mint',
              game: 'Yu-Gi-Oh!',
              imageUrls: ['/images/rect.png'],
              status: 'active',
              username: 'Sample User',
              userId: '1',
              city: 'Sample City',
              state: 'CA',
              createdAt: new Date(),
            },
            // Add more sample listings as needed
          ];
        }

        setListings(fetchedListings);
        setFilteredListings(fetchedListings);
      } catch (error) {
        console.error('Error fetching listings:', error);
        // Set sample data in case of error
        const sampleListings = [
          {
            id: '1',
            title: 'Sample Card Listing',
            price: 29.99,
            condition: 'Near Mint',
            game: 'Yu-Gi-Oh!',
            imageUrls: ['/images/rect.png'],
            status: 'active',
            username: 'Sample User',
            userId: '1',
            city: 'Sample City',
            state: 'CA',
            createdAt: new Date(),
          },
          // Add more sample listings as needed
        ];
        setListings(sampleListings);
        setFilteredListings(sampleListings);
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
    if (activeSearchParams.query) {
      const query = activeSearchParams.query.toLowerCase();
      filtered = filtered.filter(listing => 
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
      );
    }

    // Apply game filter
    if (activeSearchParams.game !== "all") {
      filtered = filtered.filter(listing => 
        listing.game?.toLowerCase() === activeSearchParams.game.toLowerCase()
      );
    }

    // Apply condition filter
    if (activeSearchParams.condition !== "all") {
      filtered = filtered.filter(listing => 
        listing.condition?.toLowerCase() === activeSearchParams.condition.toLowerCase()
      );
    }

    // Apply location filter
    if (activeSearchParams.state !== "all") {
      filtered = filtered.filter(listing => 
        listing.state?.toLowerCase() === activeSearchParams.state.toLowerCase()
      );
    }

    // Apply price filter
    filtered = filtered.filter(listing => 
      listing.price >= activeSearchParams.priceRange[0] && 
      listing.price <= activeSearchParams.priceRange[1]
    );

    setFilteredListings(filtered);
  }, [activeSearchParams, listings]);

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
          {/* Hero Section */}
          <div className="relative overflow-hidden">
            {/* Animated Background */}
            <motion.div 
              className="hero-background"
              initial="hidden"
              animate="visible"
              variants={heroBackgroundVariants}
            />
            
            <div className="relative container mx-auto px-4 py-16 sm:py-20 md:py-24 lg:py-32">
              <div className="text-center max-w-3xl mx-auto space-y-6 sm:space-y-8">
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.8,
                        staggerChildren: 0.3
                      }
                    }
                  }}
                  className="space-y-4 sm:space-y-6 pt-8 sm:pt-12 md:pt-16"
                >
                  <motion.h1 
                    variants={{
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
                    }}
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight glow-text"
                  >
                    Your Local TCG Marketplace
                  </motion.h1>
                  <motion.p 
                    variants={{
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
                    }}
                    className="text-base sm:text-lg md:text-xl glow-text-subtle"
                  >
                    {randomSubtitle}
                  </motion.p>
                </motion.div>

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
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <StateSelect
                          value={selectedState}
                          onValueChange={(state) => setSelectedState(state.toLowerCase())}
                        />
                      </div>
                      <Button className="h-10 px-8" onClick={handleSearch}>
                        <Search className="h-5 w-5" />
                      </Button>
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
                      />
                    </div>
                    
                    <div className="flex">
                      <div className="w-[180px]">
                        <StateSelect
                          value={selectedState}
                          onValueChange={(state) => setSelectedState(state.toLowerCase())}
                        />
                      </div>
                      <Button className="h-10 w-10 ml-2" size="icon" onClick={handleSearch}>
                        <Search className="h-5 w-5" />
                      </Button>
                    </div>
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