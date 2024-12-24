import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface LocationSearchProps {
  onLocationSelect: (location: { address: string; city: string; state: string }) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export const LocationSearch = ({ onLocationSelect }: LocationSearchProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize Google Places Autocomplete service
    if (window.google && !autocompleteService.current) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      placesService.current = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );
    }
  }, []);

  const handleSearch = async () => {
    if (!searchInput || !autocompleteService.current) return;

    try {
      const response = await new Promise((resolve, reject) => {
        autocompleteService.current.getPlacePredictions(
          {
            input: searchInput,
            componentRestrictions: { country: 'us' },
            types: ['establishment', 'geocode']
          },
          (predictions: any[], status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK) {
              resolve(predictions);
            } else {
              reject(status);
            }
          }
        );
      });

      setPredictions(response as any[]);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    }
  };

  const handlePredictionSelect = (placeId: string) => {
    setIsLoading(true);
    placesService.current.getDetails(
      {
        placeId: placeId,
        fields: ['address_components', 'formatted_address']
      },
      (place: any, status: string) => {
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
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

          onLocationSelect({
            address: place.formatted_address,
            city,
            state
          });
          
          setSearchInput('');
          setPredictions([]);
        }
      }
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput) {
        handleSearch();
      } else {
        setPredictions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="relative space-y-2">
      <Label htmlFor="location-search">Search Location</Label>
      <Input
        id="location-search"
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search for a location..."
        disabled={isLoading}
      />
      
      {predictions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto">
          <div className="p-2 space-y-1">
            {predictions.map((prediction) => (
              <Button
                key={prediction.place_id}
                variant="ghost"
                className="w-full justify-start text-left"
                onClick={() => handlePredictionSelect(prediction.place_id)}
              >
                {prediction.description}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};