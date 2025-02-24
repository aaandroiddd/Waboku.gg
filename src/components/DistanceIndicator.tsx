import { formatDistance } from '@/lib/utils';

interface DistanceIndicatorProps {
  distance: number | null;
}

export function DistanceIndicator({ distance }: DistanceIndicatorProps) {
  if (distance === null) {
    return null;
  }

  return (
    <span className="ml-2 text-sm text-muted-foreground">
      • {formatDistance(distance)}
    </span>
  );
}