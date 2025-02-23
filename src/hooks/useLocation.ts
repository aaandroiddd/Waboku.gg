import { useState, useEffect } from 'react';
import { useProfile } from './useProfile';

interface Location {
  latitude: number;
  longitude: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { userData } = useProfile();

  useEffect(() => {
    const getUserLocation = async () => {
      try {
        // First try to get location from user settings if logged in
        if (userData?.location?.latitude && userData?.location?.longitude) {
          setLocation({
            latitude: userData.location.latitude,
            longitude: userData.location.longitude
          });
          setLoading(false);
          return;
        }

        // If no user location, try browser geolocation
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
              setLoading(false);
            },
            (error) => {
              console.error('Geolocation error:', error);
              setError('Unable to get your location. Please enable location services.');
              setLoading(false);
            }
          );
        } else {
          setError('Geolocation is not supported by your browser');
          setLoading(false);
        }
      } catch (err) {
        console.error('Location error:', err);
        setError('Error getting location');
        setLoading(false);
      }
    };

    getUserLocation();
  }, [userData]);

  return { location, error, loading };
};