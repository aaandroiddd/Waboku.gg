import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";

interface LocationSearchProps {
  onLocationSelect: (location: { city: string; state: string }) => void;
  initialValues?: {
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
  const [cityInput, setCityInput] = useState(initialValues?.city || '');
  const [stateInput, setStateInput] = useState(initialValues?.state || '');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const autocompleteService = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    const checkGoogleMapsLoaded = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        setIsGoogleLoaded(true);
      } else {
        setTimeout(checkGoogleMapsLoaded, 100);
      }
    };

    checkGoogleMapsLoaded();
  }, []);

  const handleCitySearch = async (input: string) => {
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

  const handlePredictionSelect = (description: string) => {
    const parts = description.split(',');
    if (parts.length >= 2) {
      const city = parts[0].trim();
      const state = parts[1].trim().substring(0, 2);
      
      setCityInput(city);
      setStateInput(state);
      setPredictions([]);
      setIsConfirmed(true);
      onLocationSelect({ city, state });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (cityInput.length >= 2 && isGoogleLoaded) {
        handleCitySearch(cityInput);
      } else {
        setPredictions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cityInput, isGoogleLoaded]);

  const handleManualSubmit = () => {
    if (!cityInput || !stateInput) {
      setError('Both city and state are required');
      return;
    }
    setError('');
    setIsConfirmed(true);
    onLocationSelect({
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
                className="pr-10"
                autoComplete="off"
              />
              {isLoading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                isConfirmed && cityInput && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )
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
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}
    </div>
  );
};