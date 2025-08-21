import { useEffect, useState, useCallback } from 'react';
import { MapPin, Filter, Check, LayoutGrid, List, X, ArrowUpDown, Square, Image as ImageIcon } from 'lucide-react';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { Listing } from '@/types/database';
import { ListingGrid } from '@/components/ListingGrid';
import { SearchListingList } from '@/components/SearchListingList';
import Head from 'next/head';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useListings } from '@/hooks/useListings';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { FirebaseConnectionHandler } from '@/components/FirebaseConnectionHandler';
import { useSearchAnalytics } from '@/hooks/useSearchAnalytics';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
  const [mobileGridViewMode, setMobileGridViewMode] = useState<'default' | 'single' | 'image-only'>('default');

  // Persist grid density view mode across pages (desktop + mobile)
  const GRID_VIEW_MODE_STORAGE_KEY = 'listingGridViewMode';
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(GRID_VIEW_MODE_STORAGE_KEY);
        if (saved === 'default' || saved === 'single' || saved === 'image-only') {
          setMobileGridViewMode(saved as 'default' | 'single' | 'image-only');
        }
      } catch (e) {
        console.warn('Failed to read grid view mode from storage', e);
      }
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(GRID_VIEW_MODE_STORAGE_KEY, mobileGridViewMode);
      } catch (e) {
        console.warn('Failed to persist grid view mode', e);
      }
    }
  }, [mobileGridViewMode]);
  // Coerce 'single' to 'default' on desktop so only 'default' and 'image-only' are available
  useEffect(() => {
    if (!isMobile && mobileGridViewMode === 'single') {
      setMobileGridViewMode('default');
    }
  }, [isMobile, mobileGridViewMode]);
  const cycleGridViewMode = useCallback(() => {
    setMobileGridViewMode((prev) => {
      if (isMobile) {
        if (prev === 'default') return 'single';
        if (prev === 'single') return 'image-only';
        return 'default';
      } else {
        return prev === 'default' ? 'image-only' : 'default';
      }
    });
  }, [isMobile]);

  const effectiveGridViewMode: 'default' | 'single' | 'image-only' =
    !isMobile && mobileGridViewMode === 'single' ? 'default' : mobileGridViewMode;

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

  // Function to calculate distances and add proximity categories with enhanced safety
  const addDistanceInfo = (listings: Listing[]) => {
    try {
      if (!Array.isArray(listings)) {
        console.error('addDistanceInfo: listings is not an array');
        return [];
      }
      
      if (!latitude || !longitude || typeof latitude !== 'number' || typeof longitude !== 'number') {
        // Return listings without distance info if no valid location
        return listings.map(listing => {
          if (!listing || typeof listing !== 'object') return listing;
          return { ...listing, distance: Infinity, proximity: 'far' };
        });
      }

      return listings.map(listing => {
        try {
          if (!listing || typeof listing !== 'object') {
            console.warn('addDistanceInfo: Invalid listing object', listing);
            return listing;
          }
          
          const listingLat = listing.coordinates?.latitude;
          const listingLng = listing.coordinates?.longitude;
          
          const distance = (listingLat != null && listingLng != null && 
                           typeof listingLat === 'number' && typeof listingLng === 'number')
            ? calculateDistance(latitude, longitude, listingLat, listingLng)
            : Infinity;
          
          // Add proximity category with safety checks
          let proximity = 'far';
          if (typeof distance === 'number' && !isNaN(distance)) {
            if (distance <= 5) proximity = 'very-close';
            else if (distance <= 15) proximity = 'close';
            else if (distance <= 30) proximity = 'medium';
          }
          
          return { ...listing, distance, proximity };
        } catch (error) {
          console.error('Error processing listing in addDistanceInfo:', error, listing);
          return { ...listing, distance: Infinity, proximity: 'far' };
        }
      });
    } catch (error) {
      console.error('Critical error in addDistanceInfo:', error);
      return Array.isArray(listings) ? listings : [];
    }
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
    try {
      // Ensure allListings is an array and filter out null/undefined entries
      const safeListings = Array.isArray(allListings) ? allListings.filter(Boolean) : [];
      
      // First filter out inactive listings with comprehensive null safety
      let filtered = safeListings.filter(listing => {
        try {
          return listing && 
                 typeof listing === 'object' && 
                 listing.status && 
                 String(listing.status) === 'active';
        } catch (error) {
          console.error('Error checking listing status:', error, listing);
          return false;
        }
      });

      // Apply search query filter with ultra-enhanced safety
      if (searchQuery && String(searchQuery).trim()) {
        const query = String(searchQuery).toLowerCase().trim();
        filtered = filtered.filter(listing => {
          try {
            if (!listing || typeof listing !== 'object') return false;
            
            // Safely extract and convert title and description to strings with multiple fallbacks
            let title = '';
            let description = '';
            
            try {
              if (listing.title != null) {
                title = String(listing.title);
                if (typeof title === 'string' && title.toLowerCase) {
                  title = title.toLowerCase();
                } else {
                  title = '';
                }
              }
            } catch (titleError) {
              console.error('Error processing title:', titleError, listing.title);
              title = '';
            }
            
            try {
              if (listing.description != null) {
                description = String(listing.description);
                if (typeof description === 'string' && description.toLowerCase) {
                  description = description.toLowerCase();
                } else {
                  description = '';
                }
              }
            } catch (descError) {
              console.error('Error processing description:', descError, listing.description);
              description = '';
            }
            
            // Triple-check that we have valid strings with includes method before using
            let titleMatch = false;
            let descriptionMatch = false;
            
            try {
              if (typeof title === 'string' && 
                  typeof title.includes === 'function' && 
                  typeof query === 'string' && 
                  query.length > 0) {
                titleMatch = title.includes(query);
              }
            } catch (titleMatchError) {
              console.error('Error in title includes:', titleMatchError, { title, query });
              titleMatch = false;
            }
            
            try {
              if (typeof description === 'string' && 
                  typeof description.includes === 'function' && 
                  typeof query === 'string' && 
                  query.length > 0) {
                descriptionMatch = description.includes(query);
              }
            } catch (descMatchError) {
              console.error('Error in description includes:', descMatchError, { description, query });
              descriptionMatch = false;
            }
            
            return titleMatch || descriptionMatch;
          } catch (error) {
            console.error('Error filtering by search query:', error, { 
              listing: listing ? { id: listing.id, title: listing.title } : null, 
              query 
            });
            return false;
          }
        });
      }

      // Apply game filter with enhanced safety
      if (selectedGame && String(selectedGame) !== "all") {
        filtered = filtered.filter(listing => {
          try {
            if (!listing || typeof listing !== 'object' || !listing.game) return false;
            
            let listingGame = '';
            try {
              listingGame = String(listing.game || '');
              if (typeof listingGame === 'string' && listingGame.toLowerCase) {
                listingGame = listingGame.toLowerCase();
              } else {
                listingGame = '';
              }
            } catch (gameError) {
              console.error('Error processing listing game:', gameError, listing.game);
              return false;
            }
            
            const gameMapping = GAME_NAME_MAPPING[selectedGame];
            
            if (!gameMapping || !Array.isArray(gameMapping)) {
              console.warn(`No game mapping found for selectedGame: ${selectedGame}`);
              return false;
            }
            
            return gameMapping.some(name => {
              try {
                if (name == null || typeof name !== 'string') return false;
                
                let nameString = '';
                try {
                  nameString = String(name);
                  if (typeof nameString === 'string' && nameString.toLowerCase) {
                    nameString = nameString.toLowerCase();
                  } else {
                    return false;
                  }
                } catch (nameError) {
                  console.error('Error processing game name:', nameError, name);
                  return false;
                }
                
                // Ensure both strings are valid before comparison
                return typeof listingGame === 'string' && 
                       typeof nameString === 'string' && 
                       listingGame === nameString;
              } catch (error) {
                console.error('Error comparing game names:', error, { name, listingGame });
                return false;
              }
            });
          } catch (error) {
            console.error('Error filtering by game:', error, { 
              listing: listing ? { id: listing.id, game: listing.game } : null, 
              selectedGame 
            });
            return false;
          }
        });
      }

      // Apply condition filter with enhanced safety
      if (selectedCondition && String(selectedCondition) !== "all") {
        filtered = filtered.filter(listing => {
          try {
            if (!listing || typeof listing !== 'object' || !listing.condition) return false;
            
            let condition = '';
            let selectedConditionLower = '';
            
            try {
              condition = String(listing.condition || '');
              if (typeof condition === 'string' && condition.toLowerCase) {
                condition = condition.toLowerCase();
              } else {
                return false;
              }
            } catch (condError) {
              console.error('Error processing condition:', condError, listing.condition);
              return false;
            }
            
            try {
              selectedConditionLower = String(selectedCondition || '');
              if (typeof selectedConditionLower === 'string' && selectedConditionLower.toLowerCase) {
                selectedConditionLower = selectedConditionLower.toLowerCase();
              } else {
                return false;
              }
            } catch (selCondError) {
              console.error('Error processing selected condition:', selCondError, selectedCondition);
              return false;
            }
            
            return typeof condition === 'string' && 
                   typeof selectedConditionLower === 'string' && 
                   condition === selectedConditionLower;
          } catch (error) {
            console.error('Error filtering by condition:', error, { 
              listing: listing ? { id: listing.id, condition: listing.condition } : null, 
              selectedCondition 
            });
            return false;
          }
        });
      }

      // Apply location filter with enhanced safety
      if (selectedState && String(selectedState) !== "all") {
        filtered = filtered.filter(listing => {
          try {
            if (!listing || typeof listing !== 'object' || !listing.state) return false;
            
            let state = '';
            let selectedStateLower = '';
            
            try {
              state = String(listing.state || '');
              if (typeof state === 'string' && state.toLowerCase) {
                state = state.toLowerCase();
              } else {
                return false;
              }
            } catch (stateError) {
              console.error('Error processing state:', stateError, listing.state);
              return false;
            }
            
            try {
              selectedStateLower = String(selectedState || '');
              if (typeof selectedStateLower === 'string' && selectedStateLower.toLowerCase) {
                selectedStateLower = selectedStateLower.toLowerCase();
              } else {
                return false;
              }
            } catch (selStateError) {
              console.error('Error processing selected state:', selStateError, selectedState);
              return false;
            }
            
            return typeof state === 'string' && 
                   typeof selectedStateLower === 'string' && 
                   state === selectedStateLower;
          } catch (error) {
            console.error('Error filtering by state:', error, { 
              listing: listing ? { id: listing.id, state: listing.state } : null, 
              selectedState 
            });
            return false;
          }
        });
      }

      // Apply price filter with enhanced null safety
      filtered = filtered.filter(listing => {
        try {
          if (!listing || typeof listing !== 'object') return false;
          
          const price = listing.price != null && !isNaN(Number(listing.price)) ? Number(listing.price) : 0;
          const minPrice = priceRange && priceRange[0] != null && !isNaN(Number(priceRange[0])) ? Number(priceRange[0]) : 0;
          const maxPrice = priceRange && priceRange[1] != null && !isNaN(Number(priceRange[1])) ? Number(priceRange[1]) : 50000;
          
          return price >= minPrice && price <= maxPrice;
        } catch (error) {
          console.error('Error filtering by price:', error, { 
            listing: listing ? { id: listing.id, price: listing.price } : null, 
            priceRange 
          });
          return false;
        }
      });

      // Apply graded filter with enhanced safety
      if (showGradedOnly) {
        filtered = filtered.filter(listing => {
          try {
            return listing && 
                   typeof listing === 'object' && 
                   Boolean(listing.isGraded);
          } catch (error) {
            console.error('Error filtering by graded status:', error, listing);
            return false;
          }
        });
      }

      // Add distance information to filtered listings
      try {
        filtered = addDistanceInfo(filtered);
      } catch (error) {
        console.error('Error adding distance info:', error);
        // Continue without distance info if there's an error
      }

      // Apply sorting with enhanced safety
      try {
        filtered = sortListings(filtered, sortBy);
      } catch (error) {
        console.error('Error sorting listings:', error);
        // Continue with unsorted listings if there's an error
      }

      setFilteredListings(Array.isArray(filtered) ? filtered : []);

      // Update search session for analytics
      try {
        if (searchQuery && String(searchQuery).trim()) {
          updateSearchSession(String(searchQuery).trim(), filtered.length);
        }
      } catch (error) {
        console.error('Error updating search session:', error);
        // Continue without analytics if there's an error
      }
    } catch (error) {
      console.error('Critical error in listings filter effect:', error);
      // Set empty array as fallback
      setFilteredListings([]);
    }
  }, [allListings, searchQuery, selectedState, selectedGame, selectedCondition, priceRange, showGradedOnly, sortBy, latitude, longitude, updateSearchSession]);

  // Function to sort listings based on selected criteria with ultra-enhanced safety
  const sortListings = (listings: Listing[], sortBy: string) => {
    try {
      console.log(`Sorting ${listings?.length || 0} listings by: ${sortBy}`);
      
      if (!Array.isArray(listings) || listings.length === 0) {
        console.error('Invalid or empty listings array provided to sortListings');
        return [];
      }
      
      // Filter out any null/undefined entries before sorting with extra validation
      const validListings = listings.filter(listing => {
        try {
          return listing && 
                 typeof listing === 'object' && 
                 listing.id && 
                 typeof listing.id === 'string';
        } catch (error) {
          console.error('Error validating listing in sortListings:', error, listing);
          return false;
        }
      });
      
      if (validListings.length === 0) {
        console.warn('No valid listings found after filtering');
        return [];
      }
      
      const sorted = [...validListings];
      
      switch (sortBy) {
        case "newest":
          return sorted.sort((a, b) => {
            try {
              if (!a || !b) return 0;
              
              let dateA = 0;
              let dateB = 0;
              
              try {
                if (a.createdAt) {
                  if (a.createdAt instanceof Date) {
                    dateA = a.createdAt.getTime();
                  } else if (typeof a.createdAt === 'string' || typeof a.createdAt === 'number') {
                    dateA = new Date(a.createdAt).getTime();
                  } else if (a.createdAt && typeof a.createdAt.toDate === 'function') {
                    dateA = a.createdAt.toDate().getTime();
                  }
                }
              } catch (dateAError) {
                console.error('Error parsing dateA:', dateAError, a.createdAt);
                dateA = 0;
              }
              
              try {
                if (b.createdAt) {
                  if (b.createdAt instanceof Date) {
                    dateB = b.createdAt.getTime();
                  } else if (typeof b.createdAt === 'string' || typeof b.createdAt === 'number') {
                    dateB = new Date(b.createdAt).getTime();
                  } else if (b.createdAt && typeof b.createdAt.toDate === 'function') {
                    dateB = b.createdAt.toDate().getTime();
                  }
                }
              } catch (dateBError) {
                console.error('Error parsing dateB:', dateBError, b.createdAt);
                dateB = 0;
              }
              
              return dateB - dateA;
            } catch (error) {
              console.error('Error sorting by newest:', error, { 
                a: a ? { id: a.id, createdAt: a.createdAt } : null, 
                b: b ? { id: b.id, createdAt: b.createdAt } : null 
              });
              return 0;
            }
          });
        
        case "oldest":
          return sorted.sort((a, b) => {
            try {
              if (!a || !b) return 0;
              
              let dateA = 0;
              let dateB = 0;
              
              try {
                if (a.createdAt) {
                  if (a.createdAt instanceof Date) {
                    dateA = a.createdAt.getTime();
                  } else if (typeof a.createdAt === 'string' || typeof a.createdAt === 'number') {
                    dateA = new Date(a.createdAt).getTime();
                  } else if (a.createdAt && typeof a.createdAt.toDate === 'function') {
                    dateA = a.createdAt.toDate().getTime();
                  }
                }
              } catch (dateAError) {
                console.error('Error parsing dateA:', dateAError, a.createdAt);
                dateA = 0;
              }
              
              try {
                if (b.createdAt) {
                  if (b.createdAt instanceof Date) {
                    dateB = b.createdAt.getTime();
                  } else if (typeof b.createdAt === 'string' || typeof b.createdAt === 'number') {
                    dateB = new Date(b.createdAt).getTime();
                  } else if (b.createdAt && typeof b.createdAt.toDate === 'function') {
                    dateB = b.createdAt.toDate().getTime();
                  }
                }
              } catch (dateBError) {
                console.error('Error parsing dateB:', dateBError, b.createdAt);
                dateB = 0;
              }
              
              return dateA - dateB;
            } catch (error) {
              console.error('Error sorting by oldest:', error, { 
                a: a ? { id: a.id, createdAt: a.createdAt } : null, 
                b: b ? { id: b.id, createdAt: b.createdAt } : null 
              });
              return 0;
            }
          });
        
        case "price-low":
          return sorted.sort((a, b) => {
            try {
              if (!a || !b) return 0;
              const priceA = a.price != null && !isNaN(Number(a.price)) ? Number(a.price) : 0;
              const priceB = b.price != null && !isNaN(Number(b.price)) ? Number(b.price) : 0;
              return priceA - priceB;
            } catch (error) {
              console.error('Error sorting by price low:', error, { 
                a: a ? { id: a.id, price: a.price } : null, 
                b: b ? { id: b.id, price: b.price } : null 
              });
              return 0;
            }
          });
        
        case "price-high":
          return sorted.sort((a, b) => {
            try {
              if (!a || !b) return 0;
              const priceA = a.price != null && !isNaN(Number(a.price)) ? Number(a.price) : 0;
              const priceB = b.price != null && !isNaN(Number(b.price)) ? Number(b.price) : 0;
              return priceB - priceA;
            } catch (error) {
              console.error('Error sorting by price high:', error, { 
                a: a ? { id: a.id, price: a.price } : null, 
                b: b ? { id: b.id, price: b.price } : null 
              });
              return 0;
            }
          });
        
        case "game":
          return sorted.sort((a, b) => {
            try {
              if (!a || !b) return 0;
              
              let gameA = '';
              let gameB = '';
              
              try {
                if (a.game != null) {
                  gameA = String(a.game);
                  if (typeof gameA === 'string' && gameA.toLowerCase) {
                    gameA = gameA.toLowerCase();
                  } else {
                    gameA = '';
                  }
                }
              } catch (gameAError) {
                console.error('Error processing gameA:', gameAError, a.game);
                gameA = '';
              }
              
              try {
                if (b.game != null) {
                  gameB = String(b.game);
                  if (typeof gameB === 'string' && gameB.toLowerCase) {
                    gameB = gameB.toLowerCase();
                  } else {
                    gameB = '';
                  }
                }
              } catch (gameBError) {
                console.error('Error processing gameB:', gameBError, b.game);
                gameB = '';
              }
              
              // Ensure both are valid strings before using localeCompare
              if (typeof gameA !== 'string' || typeof gameB !== 'string') return 0;
              if (typeof gameA.localeCompare !== 'function') return 0;
              
              return gameA.localeCompare(gameB);
            } catch (error) {
              console.error('Error sorting by game:', error, { 
                a: a ? { id: a.id, game: a.game } : null, 
                b: b ? { id: b.id, game: b.game } : null 
              });
              return 0;
            }
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
            try {
              if (!a || !b) return 0;
              
              let conditionA = '';
              let conditionB = '';
              
              try {
                if (a.condition != null) {
                  conditionA = String(a.condition);
                  if (typeof conditionA === 'string' && conditionA.toLowerCase) {
                    conditionA = conditionA.toLowerCase();
                  } else {
                    conditionA = '';
                  }
                }
              } catch (condAError) {
                console.error('Error processing conditionA:', condAError, a.condition);
                conditionA = '';
              }
              
              try {
                if (b.condition != null) {
                  conditionB = String(b.condition);
                  if (typeof conditionB === 'string' && conditionB.toLowerCase) {
                    conditionB = conditionB.toLowerCase();
                  } else {
                    conditionB = '';
                  }
                }
              } catch (condBError) {
                console.error('Error processing conditionB:', condBError, b.condition);
                conditionB = '';
              }
              
              // Ensure both are valid strings
              if (typeof conditionA !== 'string' || typeof conditionB !== 'string') return 0;
              
              const orderA = conditionOrder[conditionA as keyof typeof conditionOrder] || 999;
              const orderB = conditionOrder[conditionB as keyof typeof conditionOrder] || 999;
              
              return orderA - orderB;
            } catch (error) {
              console.error('Error sorting by condition:', error, { 
                a: a ? { id: a.id, condition: a.condition } : null, 
                b: b ? { id: b.id, condition: b.condition } : null 
              });
              return 0;
            }
          });
        
        default:
          return sorted.sort((a, b) => {
            try {
              if (!a || !b) return 0;
              
              let dateA = 0;
              let dateB = 0;
              
              try {
                if (a.createdAt) {
                  if (a.createdAt instanceof Date) {
                    dateA = a.createdAt.getTime();
                  } else if (typeof a.createdAt === 'string' || typeof a.createdAt === 'number') {
                    dateA = new Date(a.createdAt).getTime();
                  } else if (a.createdAt && typeof a.createdAt.toDate === 'function') {
                    dateA = a.createdAt.toDate().getTime();
                  }
                }
              } catch (dateAError) {
                console.error('Error parsing dateA:', dateAError, a.createdAt);
                dateA = 0;
              }
              
              try {
                if (b.createdAt) {
                  if (b.createdAt instanceof Date) {
                    dateB = b.createdAt.getTime();
                  } else if (typeof b.createdAt === 'string' || typeof b.createdAt === 'number') {
                    dateB = new Date(b.createdAt).getTime();
                  } else if (b.createdAt && typeof b.createdAt.toDate === 'function') {
                    dateB = b.createdAt.toDate().getTime();
                  }
                }
              } catch (dateBError) {
                console.error('Error parsing dateB:', dateBError, b.createdAt);
                dateB = 0;
              }
              
              return dateB - dateA;
            } catch (error) {
              console.error('Error sorting by default (newest):', error, { 
                a: a ? { id: a.id, createdAt: a.createdAt } : null, 
                b: b ? { id: b.id, createdAt: b.createdAt } : null 
              });
              return 0;
            }
          });
      }
    } catch (error) {
      console.error('Critical error in sortListings:', error, { 
        listingsLength: listings?.length || 0, 
        sortBy 
      });
      return Array.isArray(listings) ? listings.filter(Boolean) : [];
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
                            className="w-full h-9 px-3 py-1 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                            style={{
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 8px center',
                              backgroundSize: '12px',
                              paddingRight: '28px'
                            }}
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
                            className="w-full h-9 px-3 py-1 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                            style={{
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 8px center',
                              backgroundSize: '12px',
                              paddingRight: '28px'
                            }}
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="sm:hidden h-9"
                            onClick={cycleGridViewMode}
                            aria-label="Toggle mobile grid view"
                            title={`View: ${mobileGridViewMode}`}
                          >
                            {mobileGridViewMode === 'default' ? (
                              <LayoutGrid className="h-4 w-4" />
                            ) : mobileGridViewMode === 'single' ? (
                              <Square className="h-4 w-4" />
                            ) : (
                              <ImageIcon className="h-4 w-4" />
                            )}
                          </Button>
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
                                <select
                                  value={selectedGame}
                                  onChange={(e) => setSelectedGame(e.target.value)}
                                  className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                                  style={{
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 12px center',
                                    backgroundSize: '16px',
                                    paddingRight: '40px'
                                  }}
                                >
                                  {games.map((game) => (
                                    <option key={game.value} value={game.value}>
                                      {game.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Condition</label>
                                <select
                                  value={selectedCondition}
                                  onChange={(e) => setSelectedCondition(e.target.value)}
                                  className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                                  style={{
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 12px center',
                                    backgroundSize: '16px',
                                    paddingRight: '40px'
                                  }}
                                >
                                  {conditions.map((condition) => (
                                    <option key={condition.value} value={condition.value}>
                                      {condition.label}
                                    </option>
                                  ))}
                                </select>
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
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Sort dropdown */}
                        <div className="flex items-center">
                          <ArrowUpDown className="mr-2 h-4 w-4" />
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-[160px] h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
                            style={{
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 12px center',
                              backgroundSize: '16px',
                              paddingRight: '40px'
                            }}
                          >
                            {sortOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="hidden sm:inline-flex h-10"
                          onClick={cycleGridViewMode}
                          aria-label="Toggle grid view mode"
                          title={`View: ${effectiveGridViewMode}`}
                        >
                          {effectiveGridViewMode === 'default' ? (
                            <LayoutGrid className="h-4 w-4" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
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
                    viewMode={effectiveGridViewMode}
                    enableAnonGate={true}
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