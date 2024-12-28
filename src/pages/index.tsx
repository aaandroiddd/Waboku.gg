import React, { useState, useEffect } from "react";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { Footer } from "@/components/Footer";
import { getFirestore, collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from "next/head";
import Header from "@/components/Header";
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
      const db = getFirestore(app);
      const q = query(
        collection(db, 'listings'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      try {
        const querySnapshot = await getDocs(q);
        let fetchedListings = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date()
          };
        }) as Listing[];

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

        setListings(fetchedListings);
        setFilteredListings(fetchedListings);
      } catch (error) {
        console.error('Error fetching listings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [latitude, longitude]);

  useEffect(() => {
    let filtered = [...listings];

    // Apply search filter
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
      listing.price >= priceRange[0] && listing.price <= priceRange[1]
    );

    setFilteredListings(filtered);
  }, [searchQuery, selectedGame, selectedCondition, selectedState, priceRange, listings]);

  const handleSearch = () => {
    // The filtering is already handled by the useEffect above
    setFilterOpen(false);
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
          <div className="relative">
            {/* Background Cards */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-[url('/images/tcg-bg.svg')] bg-repeat opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-500/5 to-blue-600/5" />
            
            <div className="relative container mx-auto px-4 py-8 sm:py-12 md:py-16 lg:py-24">
              <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight glow-text">
                  Your Local TCG Marketplace
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8">
                  {randomSubtitle}
                </p>

                {/* Search Section */}
                <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="Search for cards..."
                      className="pl-10 h-12 w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Popover open={stateOpen} onOpenChange={setStateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full sm:w-[200px] h-12 justify-between"
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          {selectedState === "all" 
                            ? "All Locations"
                            : usStates.find((state) => state.value === selectedState)?.label || "Select location"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search state..." className="h-9" />
                          <CommandEmpty>No state found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {usStates.map((state) => (
                                <CommandItem
                                  key={state.value}
                                  value={state.label}
                                  onSelect={() => {
                                    setSelectedState(state.value);
                                    setStateOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedState === state.value ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {state.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" className="h-12 px-4">
                          <Filter className="h-4 w-4 mr-2" />
                          Filters
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Filter Listings</SheetTitle>
                          <SheetDescription>
                            Refine your search with these filters
                          </SheetDescription>
                        </SheetHeader>
                        <div className="py-4 space-y-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Game</label>
                            <Select value={selectedGame} onValueChange={setSelectedGame}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select game" />
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

                          <div className="space-y-4">
                            <label className="text-sm font-medium">Price Range</label>
                            <div className="px-2">
                              <Slider
                                min={0}
                                max={1000}
                                step={10}
                                value={priceRange}
                                onValueChange={setPriceRange}
                              />
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>${priceRange[0]}</span>
                              <span>${priceRange[1]}</span>
                            </div>
                          </div>
                        </div>
                        <SheetFooter>
                          <Button variant="outline" onClick={resetFilters}>
                            Reset Filters
                          </Button>
                          <Button onClick={handleSearch}>
                            Apply Filters
                          </Button>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>

                    <Button className="h-12 w-12 sm:w-12" size="icon" onClick={handleSearch}>
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Active Filters */}
                {(selectedGame !== "all" || selectedCondition !== "all" || selectedState !== "all" || priceRange[0] !== 0 || priceRange[1] !== 1000) && (
                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {selectedGame !== "all" && (
                      <Badge variant="secondary" className="px-3 py-1">
                        {games.find(g => g.value === selectedGame)?.label}
                      </Badge>
                    )}
                    {selectedCondition !== "all" && (
                      <Badge variant="secondary" className="px-3 py-1">
                        {conditions.find(c => c.value === selectedCondition)?.label}
                      </Badge>
                    )}
                    {selectedState !== "all" && (
                      <Badge variant="secondary" className="px-3 py-1">
                        {usStates.find(s => s.value === selectedState)?.label}
                      </Badge>
                    )}
                    {(priceRange[0] !== 0 || priceRange[1] !== 1000) && (
                      <Badge variant="secondary" className="px-3 py-1">
                        ${priceRange[0]} - ${priceRange[1]}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Listings Section */}
          <section className="container mx-auto px-4 py-8 sm:py-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold">
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
      </div>
    </>
  );
}