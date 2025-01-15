import { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress"

interface ListingTimerProps {
  archivedAt: Date | number | string;
  expiresIn?: number; // in milliseconds, default 7 days
  listingId?: string;
}

export function ListingTimer({ archivedAt, expiresIn = 7 * 24 * 60 * 60 * 1000, listingId }: ListingTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [hasTriggeredCleanup, setHasTriggeredCleanup] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const archiveTime = archivedAt instanceof Date 
        ? archivedAt.getTime() 
        : typeof archivedAt === 'string' 
          ? new Date(archivedAt).getTime() 
          : archivedAt;
      
      const now = Date.now();
      const elapsed = now - archiveTime;
      const remaining = Math.max(0, expiresIn - elapsed);
      const progressValue = ((expiresIn - remaining) / expiresIn) * 100;
      
      setTimeLeft(remaining);
      setProgress(progressValue);

      // Trigger cleanup when timer expires
      if (remaining === 0 && !hasTriggeredCleanup) {
        setHasTriggeredCleanup(true);
        triggerCleanup();
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [archivedAt, expiresIn, hasTriggeredCleanup]);

  const triggerCleanup = async () => {
    try {
      const response = await fetch('/api/cleanup-inactive-listings', {
        method: 'POST',
      });
      
      if (!response.ok) {
        console.error('Failed to trigger cleanup');
      }
    } catch (error) {
      console.error('Error triggering cleanup:', error);
    }
  };

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  if (timeLeft === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">
          Listing expired
        </div>
        <Progress value={100} className="h-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-muted-foreground">
        Expires in: {days}d {hours}h {minutes}m
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}