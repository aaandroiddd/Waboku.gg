import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Script from 'next/script';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Textarea } from "@/components/ui/textarea";
import { containsExplicitContent } from "@/util/string";

interface LocationInputProps {
  onLocationSelect?: (city: string, state: string) => void;
  onChange?: (location: string) => void;
  value?: string;
  initialCity?: string;
  initialState?: string;
  error?: string;
  placeholder?: string;
}

declare global {
  interface Window {
    google: any;
    initializeAutocomplete: () => void;
  }
}

export function LocationInput({ 
  onLocationSelect, 
  onChange, 
  value, 
  initialCity, 
  initialState, 
  error: externalError, 
  placeholder = "Search for your location..." 
}: LocationInputProps) {
  const [searchValue, setSearchValue] = useState(value || (initialCity && initialState ? `${initialCity}, ${initialState}` : ''));
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [manualLocation, setManualLocation] = useState(initialCity && initialState ? `${initialCity}, ${initialState}` : '');
  const [error, setError] = useState<string | undefined>(externalError);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize autocomplete when Google Maps is loaded
  const initializeAutocomplete = () => {
    if (!window.google?.maps?.places) {
      setGoogleLoadError(true);
      return;
    }

    try {
      if (inputRef.current && window.google) {
        const options = {
          types: ['(cities)'],
          // Removed country restriction to allow global locations
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
        };

        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          inputRef.current,
          options
        );

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          
          if (place.address_components) {
            let city = '';
            let state = '';
            let country = '';
            
            for (const component of place.address_components) {
              if (component.types.includes('locality')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
              if (component.types.includes('country')) {
                country = component.long_name;
              }
            }

            // Create a location string that includes country information when not in the US
            let locationString = '';
            if (city && state) {
              locationString = `${city}, ${state}`;
            } else if (city && country) {
              locationString = `${city}, ${country}`;
            } else if (place.formatted_address) {
              locationString = place.formatted_address;
            }

            if (locationString) {
              setSearchValue(locationString);
              
              // For backward compatibility, still pass city and state to onLocationSelect
              if (onLocationSelect) {
                onLocationSelect(city || locationString, state || country || '');
              }
              if (onChange) {
                onChange(locationString);
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error initializing Google Places:', error);
      setGoogleLoadError(true);
    }
  };

  const handleFallbackSubmit = () => {
    if (manualLocation.trim()) {
      // Check for explicit content before submitting
      if (containsExplicitContent(manualLocation)) {
        setError("Location contains inappropriate content");
        return;
      }
      
      setSearchValue(manualLocation);
      
      // Extract city and state-like information from manual input
      const parts = manualLocation.split(',').map(part => part.trim());
      const city = parts[0] || '';
      const state = parts.length > 1 ? parts[1] : '';
      
      // Call the appropriate callback based on which was provided
      if (onLocationSelect) {
        onLocationSelect(city, state);
      }
      if (onChange) {
        onChange(manualLocation);
      }
    }
  };

  const retryGoogleMaps = () => {
    setGoogleLoadError(false);
    setUseFallback(false);
    setIsGoogleLoaded(false);
    // Re-inject the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.onload = () => {
      setIsGoogleLoaded(true);
      initializeAutocomplete();
    };
    script.onerror = () => {
      setGoogleLoadError(true);
    };
    document.head.appendChild(script);
  };

  // Update searchValue when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setSearchValue(value);
    }
  }, [value]);
  
  // Update error state when external error changes
  useEffect(() => {
    setError(externalError);
  }, [externalError]);

  useEffect(() => {
    // Check if Google Maps is already loaded and we're not in fallback mode
    if (window.google && window.google.maps && !useFallback) {
      initializeAutocomplete();
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isGoogleLoaded, useFallback]);

  if (useFallback || googleLoadError) {
    return (
      <div className="space-y-4">
        {googleLoadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Unable to load Google Maps. Using manual location input instead.
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2"
                onClick={retryGoogleMaps}
              >
                <ReloadIcon className="mr-2 h-4 w-4" />
                Retry Google Maps
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label>Enter your location *</Label>
          <Textarea
            value={manualLocation}
            onChange={(e) => {
              const newValue = e.target.value;
              setManualLocation(newValue);
              
              // Check for explicit content
              if (containsExplicitContent(newValue)) {
                setError("Location contains inappropriate content");
                return;
              } else {
                setError(undefined);
              }
              
              // Auto-update location as user types
              if (newValue.trim()) {
                setSearchValue(newValue);
                
                // Extract city and state-like information from manual input
                const parts = newValue.split(',').map(part => part.trim());
                const city = parts[0] || '';
                const state = parts.length > 1 ? parts[1] : '';
                
                // Call the appropriate callback based on which was provided
                if (onLocationSelect) {
                  onLocationSelect(city, state);
                }
                if (onChange) {
                  onChange(newValue);
                }
              }
            }}
            placeholder="Enter your full location (e.g., City, Region, Country)"
            className={error ? "border-red-500" : ""}
          />
          <p className="text-sm text-muted-foreground">
            Please enter your location in the format: City, Region/State, Country (if applicable)
          </p>
        </div>

        <div className="flex justify-end items-center gap-2">
          {!googleLoadError && (
            <Button 
              variant="outline"
              onClick={() => {
                setUseFallback(false);
                setSearchValue(manualLocation || '');
              }}
            >
              Switch to search
            </Button>
          )}
        </div>
        
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        onLoad={() => setIsGoogleLoaded(true)}
        onError={() => {
          setGoogleLoadError(true);
          setUseFallback(true);
        }}
      />
      <div className="space-y-2">
        <Label>Location *</Label>
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setSearchValue(newValue);
              
              // Check for explicit content
              if (containsExplicitContent(newValue)) {
                setError("Location contains inappropriate content");
                return;
              } else {
                setError(undefined);
              }
              
              if (onChange) {
                onChange(newValue);
              }
              
              // Extract city and state-like information from manual input
              const parts = newValue.split(',').map(part => part.trim());
              const city = parts[0] || '';
              const state = parts.length > 1 ? parts[1] : '';
              
              // Call onLocationSelect with the parsed city and state
              if (onLocationSelect && city) {
                onLocationSelect(city, state);
              }
            }}
            placeholder={placeholder}
            className={`h-12 bg-white dark:bg-gray-800 midnight:bg-gray-900 border-2 ${error ? "border-red-500" : "border-primary/30 focus-visible:border-primary"} shadow-sm`}
          />
          <div className="absolute right-3 top-3 text-primary/70">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Search for your location worldwide (city, region, country)
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setUseFallback(true)}
            className="mt-2"
          >
            Switch to manual input
          </Button>
        </div>
      </div>
    </>
  );
}