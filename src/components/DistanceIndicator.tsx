import { MapPin } from 'lucide-react';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useEffect, useState } from 'react';

interface DistanceIndicatorProps {
  targetLat?: number;
  targetLon?: number;
  distance?: number | null;
}

// Format distance for display
const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return 'Less than 1 mile';
  } else if (distance <= 5) {
    return `${distance.toFixed(1)} mi - Very Close!`;
  } else if (distance <= 20) {
    return `${distance.toFixed(1)} mi - Nearby`;
  } else {
    return `${distance.toFixed(1)} mi`;
  }
};

export function DistanceIndicator({ targetLat, targetLon, distance: propDistance }: DistanceIndicatorProps) {
  const geolocation = useGeolocation({ autoRequest: false });
  const [distance, setDistance] = useState<number | null>(propDistance || null);

  useEffect(() => {
    // If distance is directly provided, use it
    if (propDistance !== undefined) {
      setDistance(propDistance);
      return;
    }

    // If we don't have target coordinates or user location, we can't calculate distance
    if (!targetLat || !targetLon || !geolocation || !geolocation.latitude || !geolocation.longitude) {
      setDistance(null);
      return;
    }

    // Calculate distance between user location and target location
    try {
      const calculatedDistance = calculateDistance(
        geolocation.latitude,
        geolocation.longitude,
        targetLat,
        targetLon
      );
      
      setDistance(calculatedDistance);
    } catch (error) {
      console.error('Error calculating distance:', error);
      setDistance(null);
    }
  }, [geolocation, targetLat, targetLon, propDistance]);

  if (distance === null) {
    return null;
  }

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${
      distance <= 5 
        ? 'text-green-500 dark:text-green-400'
        : distance <= 20
        ? 'text-blue-500 dark:text-blue-400'
        : distance <= 50
        ? 'text-yellow-500 dark:text-yellow-400'
        : 'text-muted-foreground'
    }`}>
      <MapPin className={`h-3 w-3 ${distance <= 5 && 'animate-pulse'}`} />
      {formatDistance(distance)}
    </span>
  );
}