import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    const checkGoogleMapsLoaded = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        placesService.current = new window.google.maps.places.PlacesService(
          document.createElement('div')
        );
        setIsGoogleLoaded(true);
      } else {
        // Check again in 100ms
        setTimeout(checkGoogleMapsLoaded, 100);
      }
    };

    checkGoogleMapsLoaded();
  }, []);

  const handleSearch = async (input: string) => {
    if (!input || !autocompleteService.current || !isGoogleLoaded) return;
    setIsLoading(true);

    try {
      const response = await new Promise((resolve, reject) => {
        autocompleteService.current.getPlacePredictions(
          {
            input,
            componentRestrictions: { country: 'us' },
            types: ['establishment', 'geocode'], // Allow establishments and general locations
          },
          (predictions: any[], status: string) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
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
    } finally {
      setIsLoading(false);
    }
  };

  const handlePredictionSelect = (placeId: string, description: string) => {
    if (!isGoogleLoaded) return;
    
    setIsLoading(true);
    setSearchInput(description); // Update input field immediately with selection

    placesService.current.getDetails(
      {
        placeId: placeId,
        fields: ['address_components', 'formatted_address']
      },
      (place: any, status: string) => {
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          let city = '';
          let state = '';
          
          place.address_components.forEach((component: any) => {
            if (component.types.includes('locality')) {
              city = component.long_name;
            } else if (component.types.includes('sublocality')) {
              // Fallback to sublocality if locality is not available
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.short_name;
            }
          });

          // If city is still empty, try to extract it from formatted address
          if (!city && place.formatted_address) {
            const addressParts = place.formatted_address.split(',');
            if (addressParts.length >= 2) {
              city = addressParts[addressParts.length - 3]?.trim() || '';
            }
          }

          onLocationSelect({
            address: place.formatted_address,
            city,
            state
          });
          
          setPredictions([]);
        }
      }
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.length >= 2 && isGoogleLoaded) {
        handleSearch(searchInput);
      } else {
        setPredictions([]);
      }
    }, 300); // Debounce time reduced for better responsiveness

    return () => clearTimeout(timer);
  }, [searchInput, isGoogleLoaded]);

  return (
    <div className="relative space-y-2">
      <Label htmlFor="location-search">Search Location</Label>
      <div className="relative">
        <Input
          id="location-search"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Enter address, place, or city..."
          className="pr-10"
          autoComplete="off"
          disabled={!isGoogleLoaded}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      
      {predictions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto shadow-lg">
          <div className="p-2 space-y-1">
            {predictions.map((prediction) => (
              <Button
                key={prediction.place_id}
                variant="ghost"
                className="w-full justify-start text-left hover:bg-muted"
                onClick={() => handlePredictionSelect(prediction.place_id, prediction.description)}
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