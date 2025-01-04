import { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress"

interface ListingTimerProps {
  archivedAt: Date | number;
  expiresIn?: number; // in milliseconds, default 7 days
}

export function ListingTimer({ archivedAt, expiresIn = 7 * 24 * 60 * 60 * 1000 }: ListingTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deactivatedTime = deactivatedAt instanceof Date ? deactivatedAt.getTime() : deactivatedAt;
      const now = Date.now();
      const elapsed = now - deactivatedTime;
      const remaining = Math.max(0, expiresIn - elapsed);
      const progressValue = ((expiresIn - remaining) / expiresIn) * 100;
      
      setTimeLeft(remaining);
      setProgress(progressValue);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [deactivatedAt, expiresIn]);

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