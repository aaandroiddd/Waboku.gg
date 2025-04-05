import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

interface Location {
  latitude: number;
  longitude: number;
}

interface LocationOptions {
  autoRequest?: boolean;
}

export const useLocation = (options: LocationOptions = { autoRequest: false }) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      // First try to get location from user settings if logged in
      if (user?.uid) {
        const userDoc = await getDoc(doc(firebaseDb, 'users', user.uid));
        const userData = userDoc.data();
        
        if (userData?.location?.latitude && userData?.location?.longitude) {
          setLocation({
            latitude: userData.location.latitude,
            longitude: userData.location.longitude
          });
          setLoading(false);
          return;
        }
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
  }, [user]);

  useEffect(() => {
    // Only request location automatically if autoRequest is true
    if (options.autoRequest) {
      requestLocation();
    } else {
      setLoading(false);
    }
  }, [options.autoRequest, requestLocation]);

  return { location, error, loading, requestLocation };
};