import { useEffect, useState } from 'react';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import Head from 'next/head';
import Header from '@/components/Header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Filter, Check } from 'lucide-react';
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

const games = [
  { value: "all", label: "All Games" },
  { value: "pokemon", label: "Pokemon" },
  { value: "mtg", label: "Magic: The Gathering" },
  { value: "yugioh", label: "Yu-Gi-Oh!" },
  { value: "lorcana", label: "Disney Lorcana" },
  { value: "onepiece", label: "One Piece Card Game" },
  { value: "dbs", label: "Dragon Ball Super Card Game" },
  { value: "star-wars", label: "Star Wars: Unlimited" },
  { value: "flesh-and-blood", label: "Flesh and Blood" },
  { value: "weiss", label: "Weiss Schwarz" },
  { value: "universus", label: "Universus" },
  { value: "digimon", label: "Digimon" },
  { value: "vanguard", label: "Vanguard" },
  { value: "other", label: "Other" }
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
  // ... (rest of the states)
];

export default function ListingsPage() {
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
    let filtered = [...allListings];

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
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search for cards..."
                    className="pl-10 h-12 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Popover open={stateOpen} onOpenChange={setStateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-12 whitespace-nowrap"
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

                  <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="h-12">
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
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
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Price Range</label>
                          <div className="pt-4">
                            <Slider
                              value={priceRange}
                              min={0}
                              max={1000}
                              step={10}
                              onValueChange={setPriceRange}
                            />
                            <div className="flex justify-between mt-2">
                              <span className="text-sm">${priceRange[0]}</span>
                              <span className="text-sm">${priceRange[1]}</span>
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

                  <Button className="h-12 w-12" size="icon" onClick={handleSearch}>
                    <Search className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {error ? (
              <Alert variant="destructive" className="mb-8">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <ListingGrid listings={filteredListings} loading={isLoading} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}