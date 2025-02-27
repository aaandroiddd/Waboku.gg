import { formatDistance } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { useEffect, useState } from 'react';

interface DistanceIndicatorProps {
  targetLat: number;
  targetLon: number;
  distance?: number | null;
}

export function DistanceIndicator({ targetLat, targetLon, distance: propDistance }: DistanceIndicatorProps) {
  const geolocation = useGeolocation();
  const [distance, setDistance] = useState<number | null>(propDistance || null);

  useEffect(() => {
    if (propDistance !== undefined) {
      setDistance(propDistance);
      return;
    }

    if (!geolocation || !geolocation.latitude || !geolocation.longitude) {
      setDistance(null);
      return;
    }

    // Calculate distance between user location and target location
    const calculatedDistance = calculateDistance(
      geolocation.latitude,
      geolocation.longitude,
      targetLat,
      targetLon
    );
    
    setDistance(calculatedDistance);
  }, [geolocation, targetLat, targetLon, propDistance]);

  if (distance === null) {
    return null;
  }

  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
      <MapPin className="h-3 w-3" />
      {formatDistance(distance)}
    </span>
  );
}