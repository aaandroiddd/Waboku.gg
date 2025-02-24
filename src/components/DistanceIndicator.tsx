import { formatDistance } from '@/lib/utils';
import { MapPin } from 'lucide-react';

interface DistanceIndicatorProps {
  distance: number | null;
}

export function DistanceIndicator({ distance }: DistanceIndicatorProps) {
  if (distance === null) {
    return null;
  }

  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <MapPin className="h-3 w-3" />
      {formatDistance(distance)}
    </span>
  );
}