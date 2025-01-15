import { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress"
import { ACCOUNT_TIERS } from '@/types/account';

interface ListingTimerProps {
  createdAt: Date | number | string;
  archivedAt?: Date | number | string;
  accountTier: 'free' | 'premium';
  status: 'active' | 'archived' | 'inactive';
}

export function ListingTimer({ createdAt, archivedAt, accountTier, status }: ListingTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [hasTriggeredCleanup, setHasTriggeredCleanup] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      let startTime: number;
      let duration: number;

      if (status === 'archived') {
        startTime = archivedAt instanceof Date 
          ? archivedAt.getTime() 
          : typeof archivedAt === 'string' 
            ? new Date(archivedAt).getTime() 
            : archivedAt as number;
        duration = 7 * 24 * 60 * 60 * 1000; // 7 days for archived listings
      } else {
        startTime = createdAt instanceof Date 
          ? createdAt.getTime() 
          : typeof createdAt === 'string' 
            ? new Date(createdAt).getTime() 
            : createdAt as number;
        duration = ACCOUNT_TIERS[accountTier].listingDuration * 60 * 60 * 1000;
      }
      
      const elapsed = now - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progressValue = ((duration - remaining) / duration) * 100;
      
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
  }, [createdAt, archivedAt, accountTier, status, hasTriggeredCleanup]);

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

  const formatTimeLeft = () => {
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  if (timeLeft === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-destructive">
          Listing expired
        </div>
        <Progress value={100} className="h-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-muted-foreground">
        Expires in: {formatTimeLeft()}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}