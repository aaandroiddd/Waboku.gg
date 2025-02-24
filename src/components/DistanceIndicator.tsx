import { useLocation } from '@/hooks/useLocation';
import { calculateDistance, formatDistance } from '@/lib/utils';

interface DistanceIndicatorProps {
  targetLat: number;
  targetLon: number;
}

export function DistanceIndicator({ targetLat, targetLon }: DistanceIndicatorProps) {
  const { location, loading, error } = useLocation();

  if (loading || error || !location) {
    return null;
  }

  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    targetLat,
    targetLon
  );

  return (
    <span className="ml-2 text-sm text-muted-foreground">
      • {formatDistance(distance)}
    </span>
  );
}