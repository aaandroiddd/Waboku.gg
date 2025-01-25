import { useEffect, useState } from 'react';
import { Progress } from "@/components/ui/progress"
import { ACCOUNT_TIERS } from '@/types/account';
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/router';

interface ListingTimerProps {
  createdAt: Date | number | string;
  archivedAt?: Date | number | string;
  accountTier: 'free' | 'premium';
  status: 'active' | 'archived' | 'inactive';
  listingId?: string;
}

export function ListingTimer({ createdAt, archivedAt, accountTier, status, listingId }: ListingTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [hasTriggeredCleanup, setHasTriggeredCleanup] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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

      // Check if the listing has expired
      if (remaining === 0 && !hasTriggeredCleanup && status === 'active') {
        setIsExpired(true);
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
        throw new Error('Failed to archive listing');
      }

      toast({
        title: "Listing Expired",
        description: "This listing has been automatically archived.",
        duration: 5000,
      });

      // If we're on the listing page, redirect to listings
      if (router.pathname.includes('/listings/[id]')) {
        router.push('/listings');
      } else {
        // If we're on any other page, refresh to update the UI
        router.refresh();
      }
    } catch (error) {
      console.error('Error triggering cleanup:', error);
      toast({
        title: "Error",
        description: "Failed to archive the listing. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
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

  const getProgressColor = (progress: number, accountTier: string) => {
    if (accountTier === 'free') {
      if (progress > 90) return 'bg-red-500';
      if (progress > 75) return 'bg-orange-500';
      return 'bg-blue-500';
    }
    return ''; // Default color for premium users
  };

  if (isExpired || timeLeft === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Listing expired
          </AlertDescription>
        </Alert>
        <Progress value={100} className="h-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {accountTier === 'free' && status === 'active' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Free plan: Listing expires in {formatTimeLeft()}
          </AlertDescription>
        </Alert>
      )}
      {(accountTier !== 'free' || status !== 'active') && (
        <div className="text-sm text-muted-foreground">
          Expires in: {formatTimeLeft()}
        </div>
      )}
      <Progress 
        value={progress} 
        className={`h-2 ${getProgressColor(progress, accountTier)}`}
      />
    </div>
  );
}