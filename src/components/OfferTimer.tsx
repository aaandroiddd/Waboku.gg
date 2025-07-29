import { useEffect, useState, useCallback, useMemo } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, AlertTriangle } from "lucide-react";
import { format, differenceInHours, isPast } from 'date-fns';

interface OfferTimerProps {
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'countered' | 'cancelled';
  offerId: string;
  onExpired?: () => void;
}

export function OfferTimer({ expiresAt, status, offerId, onExpired }: OfferTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoize the expiration check to avoid unnecessary calculations
  const isOfferExpired = useMemo(() => {
    return isPast(expiresAt);
  }, [expiresAt]);

  // Initialize the timer after a short delay to prevent flash of expired state
  useEffect(() => {
    // If the offer is already expired, don't bother with the timer
    if (isOfferExpired || status !== 'pending') {
      setIsInitialized(true);
      setIsExpired(isOfferExpired);
      return;
    }

    const initTimer = setTimeout(() => {
      setIsInitialized(true);
    }, 500);
    
    return () => clearTimeout(initTimer);
  }, [isOfferExpired, status]);

  // Memoize the total duration calculation
  const totalDuration = useMemo(() => {
    const now = Date.now();
    const endTime = expiresAt.getTime();
    
    // Calculate total duration based on the actual expiration time
    // This supports 24h, 48h, 3 days (72h), and 7 days (168h) offers
    const createdAt = new Date(endTime - (24 * 60 * 60 * 1000)); // Assume 24h as baseline
    const actualDuration = endTime - createdAt.getTime();
    
    // Determine the total duration based on the actual expiration time
    const hoursInMs = 60 * 60 * 1000;
    const actualHours = actualDuration / hoursInMs;
    
    if (actualHours >= 150) { // Close to 7 days (168h)
      return 7 * 24 * hoursInMs; // 7 days
    } else if (actualHours >= 60) { // Close to 3 days (72h)
      return 3 * 24 * hoursInMs; // 3 days
    } else if (actualHours >= 36) { // Close to 48h
      return 48 * hoursInMs; // 48 hours
    } else {
      return 24 * hoursInMs; // 24 hours (default)
    }
  }, [expiresAt]);

  const calculateTimeLeft = useCallback(() => {
    const now = Date.now();
    const endTime = expiresAt.getTime();
    
    const remaining = Math.max(0, endTime - now);
    const elapsed = totalDuration - remaining;
    const progressValue = Math.min(100, (elapsed / totalDuration) * 100);
    
    setTimeLeft(remaining);
    setProgress(progressValue);

    const wasExpired = isExpired;
    const nowExpired = remaining === 0;
    setIsExpired(nowExpired);

    // Call onExpired callback when offer just expired (only once)
    if (!wasExpired && nowExpired && onExpired) {
      // Add a small delay to prevent multiple calls
      setTimeout(() => {
        onExpired();
      }, 100);
    }
  }, [expiresAt, totalDuration, isExpired, onExpired]);

  useEffect(() => {
    // Don't run timer for non-pending offers or if already expired
    if (!isInitialized || status !== 'pending' || isOfferExpired) {
      return;
    }
    
    calculateTimeLeft();
    
    // Use a longer interval for offers that have more than 1 hour left
    const hoursLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
    const updateInterval = hoursLeft > 1 ? 30000 : 1000; // 30 seconds vs 1 second
    
    const timer = setInterval(calculateTimeLeft, updateInterval);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, isInitialized, status, isOfferExpired]);

  const formatTimeLeft = useCallback(() => {
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [timeLeft]);

  // Don't show timer for non-pending offers
  if (status !== 'pending') {
    return null;
  }

  // If offer is already expired, show expired state immediately
  if (isOfferExpired) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This offer has expired and will be updated automatically
          </AlertDescription>
        </Alert>
        <div className="h-2 w-full bg-red-500 rounded-full" />
      </div>
    );
  }

  // Show loading state while initializing (only for non-expired offers)
  if (!isInitialized) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Loading offer status...</span>
        </div>
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '50%' }} />
        </div>
      </div>
    );
  }

  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const isExpiringSoon = hoursLeft <= 6 && timeLeft > 0; // Show warning when less than 6 hours left
  const isExpiredNow = isExpired || timeLeft === 0;

  if (isExpiredNow) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This offer has expired and will be updated automatically
          </AlertDescription>
        </Alert>
        <div className="h-2 w-full bg-red-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Alert variant={isExpiringSoon ? "destructive" : "default"}>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {isExpiringSoon ? 'Offer expires soon!' : 'Offer expires in:'}
              </span>
              <span className="font-mono text-sm">
                {formatTimeLeft()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Expires on {format(expiresAt, 'PPP')} at {format(expiresAt, 'p')}
            </div>
          </div>
        </AlertDescription>
      </Alert>
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
            isExpiringSoon 
              ? 'bg-red-500' 
              : progress > 75 
                ? 'bg-orange-500' 
                : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {isExpiringSoon && (
        <div className="text-xs text-red-600 dark:text-red-400 font-medium">
          ⚠️ This offer will expire automatically if not responded to
        </div>
      )}
    </div>
  );
}