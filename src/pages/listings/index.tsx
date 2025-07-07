import { useEffect, useState } from 'react';
import SearchBar from '@/components/SearchBar';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import { ListingGridWithAnalytics } from '@/components/ListingGridWithAnalytics';
import { SearchListingList } from '@/components/SearchListingList';
import Head from 'next/head';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Filter, Check, LayoutGrid, List, X, ArrowUpDown } from 'lucide-react';
import { useListings } from '@/hooks/useListings';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { FirebaseConnectionHandler } from '@/components/FirebaseConnectionHandler';
import { useSearchAnalytics } from '@/hooks/useSearchAnalytics';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MobileSelect } from "@/components/ui/mobile-select";
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
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

// Import game mappings from centralized file
import { GAME_MAPPING, OTHER_GAME_MAPPING, GAME_NAME_MAPPING } from '@/lib/game-mappings';

const games = [
  { value: "all", label: "All Categories" },
  ...Object.entries(GAME_MAPPING).map(([label, value]) => ({ value, label })),
  ...Object.entries(OTHER_GAME_MAPPING).map(([label, value]) => ({ value, label })),
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

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "game", label: "Game Category" },
  { value: "condition", label: "Condition" },
];

export default function ListingsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const router = useRouter();
  const [stateOpen, setStateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showWantedBanner, setShowWantedBanner] = useState(true);
  const [displayCount, setDisplayCount] = useState(8);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedGame, setSelectedGame] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 50000]);
  const [showGradedOnly, setShowGradedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("newest");

  // Use the enhanced useListings hook without pagination
  const { 
    listings: allListings, 
    isLoading, 
    error
  } = useListings({
    showOnlyActive: true
    // Allow both real and mock listings for testing
  });

  const { latitude, longitude } = useGeolocation();
  
  // Initialize analytics hooks early
  const { recordSearch } = useTrendingSearches();
  const { updateSearchSession } = useSearchAnalytics();

  // Function to calculate distances and add proximity categories
  const addDistanceInfo = (listings: Listing[]) => {
    if (!latitude || !longitude) return listings;

    return listings.map(listing => {
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
    });
  };

  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);

  useEffect(() => {
    // Initialize filters from URL parameters
    const { query, state, game, condition, minPrice, maxPrice, sort } = router.query;
    
    // Only update search query if it's different from current state
    // This prevents overriding user input with stale URL parameters
    const urlQuery = query as string || "";
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
    
    if (state) setSelectedState(state as string);
    if (game) setSelectedGame(game as string);
    if (condition) setSelectedCondition(condition as string);
    if (minPrice && maxPrice) {
      setPriceRange([Number(minPrice), Number(maxPrice)]);
    }
    if (sort) setSortBy(sort as string);
  }, [router.query]);

  useEffect(() => {
    // First filter out inactive listings
    let filtered = allListings.filter(listing => listing.status === 'active');

    // Apply search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(listing => 
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
      );
    }

    // Apply game filter
    if (selectedGame !== "all") {
      filtered = filtered.filter(listing => {
        const listingGameLower = listing.game?.toLowerCase() || '';
        return GAME_NAME_MAPPING[selectedGame]?.some(name => 
          listingGameLower === name.toLowerCase()
        ) || false;
      });
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

    // Apply graded filter
    if (showGradedOnly) {
      filtered = filtered.filter(listing => listing.isGraded);
    }

    // Add distance information to filtered listings
    filtered = addDistanceInfo(filtered);

    // Apply sorting
    filtered = sortListings(filtered, sortBy);

    setFilteredListings(filtered);

    // Update search session for analytics
    if (searchQuery.trim()) {
      updateSearchSession(searchQuery.trim(), filtered.length);
    }
  }, [allListings, searchQuery, selectedState, selectedGame, selectedCondition, priceRange, showGradedOnly, sortBy, latitude, longitude, updateSearchSession]);

  // Function to sort listings based on selected criteria
  const sortListings = (listings: Listing[], sortBy: string) => {
    console.log(`Sorting ${listings.length} listings by: ${sortBy}`);
    const sorted = [...listings];
    
    switch (sortBy) {
      case "newest":
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      case "oldest":
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      case "price-low":
        return sorted.sort((a, b) => a.price - b.price);
      
      case "price-high":
        return sorted.sort((a, b) => b.price - a.price);
      
      case "game":
        return sorted.sort((a, b) => {
          const gameA = a.game?.toLowerCase() || '';
          const gameB = b.game?.toLowerCase() || '';
          return gameA.localeCompare(gameB);
        });
      
      case "condition":
        // Define condition hierarchy for sorting
        const conditionOrder = {
          'mint': 1,
          'near mint': 2,
          'near-mint': 2,
          'excellent': 3,
          'good': 4,
          'light played': 5,
          'light-played': 5,
          'played': 6,
          'poor': 7
        };
        
        return sorted.sort((a, b) => {
          const conditionA = conditionOrder[a.condition?.toLowerCase() as keyof typeof conditionOrder] || 999;
          const conditionB = conditionOrder[b.condition?.toLowerCase() as keyof typeof conditionOrder] || 999;
          return conditionA - conditionB;
        });
      
      default:
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  };

  const handleSearch = async (searchTerm?: string) => {
    try {
      // Use provided search term or current searchQuery state
      const currentSearchTerm = searchTerm !== undefined ? searchTerm : searchQuery;
      
      // Update local state if search term was provided
      if (searchTerm !== undefined && searchTerm !== searchQuery) {
        setSearchQuery(searchTerm);
      }
      
      // Only record search term if there is one
      if (currentSearchTerm.trim()) {
        try {
          // Use the recordSearch function from useTrendingSearches hook
          console.log('Recording search term from listings page:', currentSearchTerm.trim());
          await recordSearch(currentSearchTerm.trim());
          // Add a small delay to ensure the search is recorded before refreshing the page
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Error recording search:', error);
          // Continue with search regardless of recording error
        }
      }

      // Create query object
      const queryParams: any = {};
      
      // Only add parameters that have values
      if (currentSearchTerm.trim()) {
        queryParams.query = currentSearchTerm.trim();
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

      if (sortBy !== 'newest') {
        queryParams.sort = sortBy;
      }

      // Update URL with search parameters
      router.push({
        pathname: '/listings',
        query: queryParams,
      }, undefined, { shallow: true });
    } catch (error) {
      console.error('Search error:', error);
      alert('An error occurred while processing your search. Please try again.');
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedState("all");
    setSelectedGame("all");
    setSelectedCondition("all");
    setPriceRange([0, 50000]);
    setSortBy("newest");
    router.push('/listings', undefined, { shallow: true });
  };

  return (
    <>
      <Head>
        <title>All Listings - Waboku.gg</title>
        <meta
          name="description"
          content="Browse all trading card listings on Waboku.gg"
        />
      </Head>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-[1400px] mx-auto">
            {/* Firebase Connection Handler wraps the content */}
            <FirebaseConnectionHandler>
            {/* Search Section */}
            <div className="mb-8">
              <div className="space-y-4">
                {/* Search bar with integrated button */}
                <div className="relative flex-1">
                  <SearchBar
                    showSearchButton={true}
                    initialValue={searchQuery}
                    onSearch={(query: string) => {
                      handleSearch(query);
                    }}
                  />
                </div>

                {/* Controls row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {isMobile ? (
                    /* Mobile Layout */
                    <div className="space-y-3">
                      {/* Location Button - Full Width on Mobile */}
                      <Popover open={stateOpen} onOpenChange={setStateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full h-10 justify-start"
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            {selectedState === "all" 
                              ? "All Locations"
                              : usStates.find((state) => state.value === selectedState)?.label || "Select location"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-fit p-0">
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

                      {/* Mobile Filters Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Game Category - Native Select */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Game</label>
                          <select
                            value={selectedGame}
                            onChange={(e) => setSelectedGame(e.target.value)}
                            className="w-full h-9 px-3 py-1 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {games.map((game) => (
                              <option key={game.value} value={game.value}>
                                {game.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Condition - Native Select */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Condition</label>
                          <select
                            value={selectedCondition}
                            onChange={(e) => setSelectedCondition(e.target.value)}
                            className="w-full h-9 px-3 py-1 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {conditions.map((condition) => (
                              <option key={condition.value} value={condition.value}>
                                {condition.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Price Range - Mobile */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Price Range</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={priceRange[0] || ''}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 0;
                              if (value >= 0 && value <= priceRange[1]) {
                                setPriceRange([value, priceRange[1]]);
                              }
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={priceRange[1] || ''}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 50000;
                              if (value >= priceRange[0] && value <= 50000) {
                                setPriceRange([priceRange[0], value]);
                              }
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>

                      {/* Sort and View Controls - Mobile */}
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Sort by</label>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full h-9 px-3 py-1 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {sortOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col items-center">
                          <label className="text-xs font-medium text-muted-foreground mb-1">View</label>
                          <div className="inline-flex rounded-lg border bg-card p-1 h-9">
                            <Button
                              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="px-2 h-7"
                              onClick={() => setViewMode('grid')}
                            >
                              <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="px-2 h-7"
                              onClick={() => setViewMode('list')}
                            >
                              <List className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Clear Filters - Mobile */}
                      {(searchQuery || selectedState !== 'all' || selectedGame !== 'all' || 
                        selectedCondition !== 'all' || priceRange[0] !== 0 || priceRange[1] !== 50000 || 
                        showGradedOnly) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    /* Desktop Layout */
                    <>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Popover open={stateOpen} onOpenChange={setStateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="h-10"
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              <span className="hidden sm:inline">
                                {selectedState === "all" 
                                  ? "All Locations"
                                  : usStates.find((state) => state.value === selectedState)?.label || "Select location"}
                              </span>
                              <span className="sm:hidden">Location</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-fit p-0">
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
                            <Button variant="outline" className="h-10">
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
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="graded"
                                  checked={showGradedOnly}
                                  onCheckedChange={(checked) => setShowGradedOnly(checked as boolean)}
                                />
                                <label
                                  htmlFor="graded"
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  Show Graded Cards Only
                                </label>
                              </div>
                            </div>
                            <SheetFooter>
                              <Button variant="outline" onClick={resetFilters}>Reset</Button>
                              <Button onClick={() => {
                                handleSearch();
                                setFilterOpen(false);
                              }}>Apply Filters</Button>
                            </SheetFooter>
                          </SheetContent>
                        </Sheet>

                        {/* Sort dropdown */}
                        <div className="flex items-center">
                          <ArrowUpDown className="mr-2 h-4 w-4" />
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[160px] h-10">
                              <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                              {sortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="inline-flex rounded-lg border bg-card p-1 h-10">
                        <Button
                          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="px-3 h-8"
                          onClick={() => setViewMode('grid')}
                        >
                          <LayoutGrid className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Grid</span>
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="px-3 h-8"
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">List</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>


            {/* Wanted Board banner with close button */}
            {showWantedBanner && (
              <div className="mb-6 p-4 bg-muted rounded-lg flex justify-between items-center">
                <p className="text-sm md:text-base">
                  Can't find what you're looking for? 
                  <Link href="/wanted" className="ml-2 text-primary hover:underline font-medium">
                    Click here to view the Wanted Board
                  </Link>
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => setShowWantedBanner(false)}
                >
                  <span className="sr-only">Close</span>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Results summary and active filters */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  "Loading listings..."
                ) : (
                  `Showing ${filteredListings.length} listing${filteredListings.length !== 1 ? 's' : ''}`
                )}
                {sortBy !== 'newest' && (
                  <span className="ml-2">
                    • Sorted by {sortOptions.find(opt => opt.value === sortBy)?.label}
                  </span>
                )}
              </div>
              
              {/* Active filters display */}
              {(searchQuery || selectedState !== 'all' || selectedGame !== 'all' || 
                selectedCondition !== 'all' || priceRange[0] !== 0 || priceRange[1] !== 50000 || 
                showGradedOnly) && (
                <div className="flex flex-wrap gap-2">
                  {searchQuery && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      Search: "{searchQuery}"
                    </span>
                  )}
                  {selectedState !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      {usStates.find(s => s.value === selectedState)?.label}
                    </span>
                  )}
                  {selectedGame !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      {games.find(g => g.value === selectedGame)?.label}
                    </span>
                  )}
                  {selectedCondition !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      {conditions.find(c => c.value === selectedCondition)?.label}
                    </span>
                  )}
                  {(priceRange[0] !== 0 || priceRange[1] !== 50000) && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      ${priceRange[0]} - ${priceRange[1]}
                    </span>
                  )}
                  {showGradedOnly && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                      Graded Only
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>

            {error ? (
              <Alert variant="destructive" className="mb-8">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <ListingGrid 
                    listings={filteredListings} 
                    loading={isLoading} 
                    displayCount={displayCount}
                    hasMore={filteredListings.length > displayCount}
                    onLoadMore={() => setDisplayCount(prev => prev + 8)}
                  />
                ) : (
                  <SearchListingList listings={filteredListings} loading={isLoading} />
                )}
              </>
            )}
            </FirebaseConnectionHandler>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}