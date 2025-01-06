import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";

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

export function LocationInput({ onLocationSelect, initialCity = "", initialState = "", error }: LocationInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let autocomplete: any;
    const initAutocomplete = () => {
      if (!window.google || !inputRef.current) return;

      autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['(cities)'],
        componentRestrictions: { country: 'us' },
        fields: ['address_components']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        let city = '';
        let state = '';

        place.address_components.forEach((component: any) => {
          if (component.types.includes('locality')) {
            city = component.long_name;
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
        });

        if (city && state) {
          setInputValue(`${city}, ${state}`);
          onLocationSelect(city, state);
        }
      });

      autocompleteRef.current = autocomplete;
    };

    if (window.google) {
      initAutocomplete();
    } else {
      setIsLoading(true);
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => {
        initAutocomplete();
        setIsLoading(false);
      };
      document.head.appendChild(script);
    }

    if (initialCity && initialState) {
      setInputValue(`${initialCity}, ${initialState}`);
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onLocationSelect, initialCity, initialState]);

  return (
    <div className="space-y-2">
      <Label htmlFor="location">Location *</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id="location"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter city name"
          className={error ? "border-red-500" : ""}
          required
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-sm text-muted-foreground">
        Start typing a city name and select from the dropdown
      </p>
    </div>
  );
}