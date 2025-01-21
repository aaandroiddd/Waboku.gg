import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Script from 'next/script';

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

export function LocationInput({ onLocationSelect, initialCity, initialState, error }: LocationInputProps) {
  const [searchValue, setSearchValue] = useState(initialCity ? `${initialCity}, ${initialState}` : '');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize autocomplete when Google Maps is loaded
  const initializeAutocomplete = () => {
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
  };

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && !autocompleteRef.current) {
      initializeAutocomplete();
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isGoogleLoaded]);

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        onLoad={() => setIsGoogleLoaded(true)}
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
      </div>
    </>
  );
}