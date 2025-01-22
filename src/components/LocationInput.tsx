import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Script from 'next/script';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";

interface LocationInputProps {
  onLocationSelect: (city: string, state: string) => void;
  initialCity?: string;
  initialState?: string;
  error?: string;
}

declare global {
  interface Window {
    google: any;
    initializeAutocomplete: () => void;
  }
}

// US states for fallback mode
const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming']
];

export function LocationInput({ onLocationSelect, initialCity, initialState, error }: LocationInputProps) {
  const [searchValue, setSearchValue] = useState(initialCity ? `${initialCity}, ${initialState}` : '');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackCity, setFallbackCity] = useState(initialCity || '');
  const [fallbackState, setFallbackState] = useState(initialState || '');
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
          componentRestrictions: { country: 'us' },
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
            
            for (const component of place.address_components) {
              if (component.types.includes('locality')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
            }

            if (city && state) {
              setSearchValue(`${city}, ${state}`);
              onLocationSelect(city, state);
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
    if (fallbackCity && fallbackState) {
      onLocationSelect(fallbackCity, fallbackState);
      setSearchValue(`${fallbackCity}, ${fallbackState}`);
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

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && !autocompleteRef.current) {
      initializeAutocomplete();
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isGoogleLoaded]);

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
          <Label>City *</Label>
          <Input
            type="text"
            value={fallbackCity}
            onChange={(e) => setFallbackCity(e.target.value)}
            placeholder="Enter city name"
            className={error ? "border-red-500" : ""}
          />
        </div>

        <div className="space-y-2">
          <Label>State *</Label>
          <Select value={fallbackState} onValueChange={setFallbackState}>
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between items-center gap-2">
          <Button 
            onClick={handleFallbackSubmit}
            disabled={!fallbackCity || !fallbackState}
          >
            Set Location
          </Button>
          
          {!googleLoadError && (
            <Button 
              variant="outline"
              onClick={() => {
                setUseFallback(false);
                setSearchValue(fallbackCity && fallbackState ? `${fallbackCity}, ${fallbackState}` : '');
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
        <Input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search for your city..."
          className={`h-12 ${error ? "border-red-500" : ""}`}
        />
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