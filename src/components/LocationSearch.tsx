import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";

interface LocationSearchProps {
  onLocationSelect: (location: { address?: string; city: string; state: string }) => void;
  initialValues?: {
    address?: string;
    city?: string;
    state?: string;
  };
}

declare global {
  interface Window {
    google: any;
  }
}

export const LocationSearch = ({ onLocationSelect, initialValues }: LocationSearchProps) => {
  const [addressInput, setAddressInput] = useState(initialValues?.address || '');
  const [cityInput, setCityInput] = useState(initialValues?.city || '');
  const [stateInput, setStateInput] = useState(initialValues?.state || '');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
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
        setTimeout(checkGoogleMapsLoaded, 100);
      }
    };

    checkGoogleMapsLoaded();
  }, []);

  const handleSearch = async (input: string) => {
    if (!input || !autocompleteService.current || !isGoogleLoaded) return;
    setIsLoading(true);
    setError('');
    setIsConfirmed(false);

    try {
      const response = await new Promise((resolve, reject) => {
        autocompleteService.current.getPlacePredictions(
          {
            input,
            componentRestrictions: { country: 'us' },
            types: ['address'],
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
      setError('Unable to fetch address suggestions. Please try again.');
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePredictionSelect = (placeId: string, description: string) => {
    if (!isGoogleLoaded) return;
    
    setIsLoading(true);
    setAddressInput(description);
    setPredictions([]); // Immediately clear predictions

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
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.short_name;
            }
          });

          if (!city && place.formatted_address) {
            const addressParts = place.formatted_address.split(',');
            if (addressParts.length >= 2) {
              city = addressParts[addressParts.length - 3]?.trim() || '';
            }
          }

          if (city && state) {
            setCityInput(city);
            setStateInput(state);
            onLocationSelect({
              address: place.formatted_address,
              city,
              state
            });
            setError('');
            setIsConfirmed(true);
          }
        }
      }
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (addressInput.length >= 2 && isGoogleLoaded) {
        handleSearch(addressInput);
      } else {
        setPredictions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addressInput, isGoogleLoaded]);

  const handleManualSubmit = () => {
    if (!cityInput || !stateInput) {
      setError('Both city and state are required');
      return;
    }
    setError('');
    setIsConfirmed(true);
    onLocationSelect({
      address: addressInput || undefined,
      city: cityInput,
      state: stateInput
    });
  };

  // Handle manual input confirmation
  useEffect(() => {
    if (cityInput && stateInput) {
      handleManualSubmit();
    }
  }, [cityInput, stateInput]);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city" className="required">City</Label>
            <div className="relative">
              <Input
                id="city"
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value);
                  setIsConfirmed(false);
                }}
                placeholder="Enter city"
                required
              />
              {isConfirmed && cityInput && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" className="required">State</Label>
            <div className="relative">
              <Input
                id="state"
                value={stateInput}
                onChange={(e) => {
                  setStateInput(e.target.value.toUpperCase());
                  setIsConfirmed(false);
                }}
                placeholder="Enter state (e.g., CA)"
                maxLength={2}
                required
              />
              {isConfirmed && stateInput && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
        </div>

        <div className="relative space-y-2">
          <Label htmlFor="location-search">Search Address (Optional)</Label>
          <div className="relative">
            <Input
              id="location-search"
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setIsConfirmed(false);
              }}
              placeholder="Search for a specific address..."
              className="pr-10"
              autoComplete="off"
              disabled={!isGoogleLoaded}
            />
            {isLoading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              isConfirmed && addressInput && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )
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
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}
    </div>
  );
};