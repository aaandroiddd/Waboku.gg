import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

interface Location {
  latitude: number;
  longitude: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const getUserLocation = async () => {
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
    };

    getUserLocation();
  }, [user]);

  return { location, error, loading };
};