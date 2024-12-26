import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";

interface LocationSearchProps {
  onLocationSelect: (location: { city?: string; state?: string; address?: string }) => void;
  initialValues?: {
    city?: string;
    state?: string;
    address?: string;
  };
}

declare global {
  interface Window {
    google: any;
  }
}

export const LocationSearch = ({ onLocationSelect, initialValues }: LocationSearchProps) => {
  const [cityInput, setCityInput] = useState(initialValues?.city || '');
  const [stateInput, setStateInput] = useState(initialValues?.state || '');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const autocompleteService = useRef<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const shouldNotifyParent = useRef(false);

  // Initialize Google Maps
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      setIsGoogleLoaded(true);
    }
  }, []);

  // Set initial values without triggering onLocationSelect
  useEffect(() => {
    if (initialValues) {
      setCityInput(initialValues.city || '');
      setStateInput(initialValues.state || '');
      shouldNotifyParent.current = false;
    }
  }, [initialValues]);

  const handleCitySearch = async (input: string) => {
    if (!input || !autocompleteService.current || !isGoogleLoaded) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await new Promise((resolve, reject) => {
        autocompleteService.current.getPlacePredictions(
          {
            input,
            componentRestrictions: { country: 'us' },
            types: ['(cities)']
          },
          (predictions: any[], status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              resolve(predictions);
            } else {
              reject(new Error(status));
            }
          }
        );
      });

      setPredictions(response as any[]);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setError('Unable to fetch city suggestions. Please try again.');
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCityInputChange = (value: string) => {
    setCityInput(value);
    shouldNotifyParent.current = true;
    
    // Clear any existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for search
    if (value.length >= 2) {
      debounceTimer.current = setTimeout(() => {
        handleCitySearch(value);
      }, 300);
    } else {
      setPredictions([]);
    }
  };

  const handlePredictionSelect = (description: string) => {
    const parts = description.split(',');
    if (parts.length >= 2) {
      const city = parts[0].trim();
      const state = parts[1].trim().substring(0, 2);
      
      setCityInput(city);
      setStateInput(state);
      setPredictions([]);
      shouldNotifyParent.current = true;
      
      // Notify parent when we have both values
      if (city && state) {
        onLocationSelect({ city, state });
      }
    }
  };

  const handleStateInputChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setStateInput(upperValue);
    shouldNotifyParent.current = true;
    
    // Notify parent when we have both values and should notify flag is true
    if (cityInput && upperValue && shouldNotifyParent.current) {
      onLocationSelect({ city: cityInput, state: upperValue });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <div className="relative">
            <Input
              id="city"
              value={cityInput}
              onChange={(e) => handleCityInputChange(e.target.value)}
              placeholder="Enter city (optional)"
              className="pr-10"
              autoComplete="off"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {predictions.length > 0 && (
            <Card className="absolute z-50 w-[calc(50%-1rem)] mt-1 max-h-60 overflow-auto shadow-lg">
              <div className="p-2 space-y-1">
                {predictions.map((prediction) => (
                  <Button
                    key={prediction.place_id}
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-muted"
                    onClick={() => handlePredictionSelect(prediction.description)}
                  >
                    {prediction.description}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <div className="relative">
            <Input
              id="state"
              value={stateInput}
              onChange={(e) => handleStateInputChange(e.target.value)}
              placeholder="Enter state (optional)"
              maxLength={2}
            />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}
    </div>
  );
};