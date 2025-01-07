import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocationInputProps {
  onLocationSelect: (city: string, state: string) => void;
  initialCity?: string;
  initialState?: string;
  error?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

export function LocationInput({ onLocationSelect, initialCity, initialState, error }: LocationInputProps) {
  const [searchValue, setSearchValue] = useState(initialCity ? `${initialCity}, ${initialState}` : '');
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google && inputRef.current) {
      const options = {
        types: ['(cities)'],
        componentRestrictions: { country: 'us' },
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
  }, [onLocationSelect]);

  return (
    <div className="space-y-2">
      <Label>Location *</Label>
      <Input
        ref={inputRef}
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder="Search for your city..."
        className={error ? "border-red-500" : ""}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}