import { useEffect, useState } from 'react';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import { SearchListingList } from '@/components/SearchListingList';
import Head from 'next/head';
import Header from '@/components/Header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Filter, Check, LayoutGrid, List } from 'lucide-react';
import { useListings } from '@/hooks/useListings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Import game mappings from GameCategories
import { GAME_MAPPING, OTHER_GAME_MAPPING, GAME_NAME_MAPPING } from '@/components/GameCategories';

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

export default function ListingsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const router = useRouter();
  const [stateOpen, setStateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedGame, setSelectedGame] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [showGradedOnly, setShowGradedOnly] = useState(false);

  // Use the enhanced useListings hook
  const { listings: allListings, isLoading, error } = useListings({ 
    searchQuery: searchQuery 
  });

  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);

  useEffect(() => {
    // Initialize filters from URL parameters
    const { query, state, game, condition, minPrice, maxPrice } = router.query;
    if (query) setSearchQuery(query as string);
    if (state) setSelectedState(state as string);
    if (game) setSelectedGame(game as string);
    if (condition) setSelectedCondition(condition as string);
    if (minPrice && maxPrice) {
      setPriceRange([Number(minPrice), Number(maxPrice)]);
    }
  }, [router.query]);

  useEffect(() => {
    // First filter out inactive listings
    let filtered = allListings.filter(listing => listing.status === 'active');

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

    setFilteredListings(filtered);
  }, [allListings, selectedState, selectedGame, selectedCondition, priceRange, showGradedOnly]);

  const handleSearch = () => {
    // Update URL with search parameters
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
    }, undefined, { shallow: true });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedState("all");
    setSelectedGame("all");
    setSelectedCondition("all");
    setPriceRange([0, 1000]);
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

      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-[1400px] mx-auto">
            {/* Search Section */}
            <div className="mb-8">
              <div className="space-y-4">
                {/* Search bar with integrated button */}
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="Search for cards..."
                    className="pr-[88px] h-12 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                  <Button 
                    variant="default"
                    className="absolute right-1 top-1 h-10" 
                    onClick={handleSearch}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </div>

                {/* Controls row */}
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex gap-2 items-center flex-wrap">
                    <Popover open={stateOpen} onOpenChange={setStateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="h-12"
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
                                max={1000}
                                step={1}
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
                                      if (value >= priceRange[0] && value <= 1000) {
                                        setPriceRange([priceRange[0], value]);
                                      }
                                    }}
                                    className="w-24 h-8"
                                    min={priceRange[0]}
                                    max={1000}
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
                  </div>

                  <div className="inline-flex rounded-lg border bg-card p-1 h-12">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="px-3"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Grid</span>
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="px-3"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">List</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>


            {error ? (
              <Alert variant="destructive" className="mb-8">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : viewMode === 'grid' ? (
              <ListingGrid listings={filteredListings} loading={isLoading} />
            ) : (
              <SearchListingList listings={filteredListings} loading={isLoading} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}