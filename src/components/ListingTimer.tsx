import { useEffect, useState, useCallback } from 'react';
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
  const [isExpired, setIsExpired] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Enhanced function to proactively handle expired listings
  const triggerManualCleanup = useCallback(async () => {
    if (isProcessing || !listingId) return;
    
    setIsProcessing(true);
    try {
      console.log(`Attempting to fix expired listing: ${listingId}`);
      const response = await fetch('/api/listings/fix-expired', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listingId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process listing');
      }

      const data = await response.json();
      console.log('Fix expired response:', data);
      
      if (data.status === 'archived' && status === 'active') {
        toast({
          title: "Listing Archived",
          description: "The listing has been moved to archived status.",
          duration: 5000,
        });
        
        // If we're on the listing page, redirect to listings
        if (router.pathname.includes('/listings/[id]')) {
          router.push('/listings');
        } else {
          // If we're on any other page, refresh to update the UI
          window.location.reload();
        }
      } else if (data.status === 'deleted' && status === 'archived') {
        toast({
          title: "Listing Deleted",
          description: "The archived listing has been permanently deleted.",
          duration: 5000,
        });
        
        // Refresh the page to update the UI
        window.location.reload();
      }
    } catch (error) {
      console.error('Error triggering manual cleanup:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process the listing. The system will automatically handle this soon.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [router, toast, isProcessing, status, listingId]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      let startTime: number;
      let duration: number;

      if (status === 'archived' && archivedAt) {
        // For archived listings, use archivedAt as start time and 7 days duration
        try {
          if (archivedAt instanceof Date) {
            startTime = archivedAt.getTime();
          } else if (typeof archivedAt === 'object') {
            // Handle Firestore Timestamp with seconds and nanoseconds
            if ('seconds' in archivedAt) {
              startTime = archivedAt.seconds * 1000;
            } else if ('_seconds' in archivedAt) {
              startTime = archivedAt._seconds * 1000;
            } else {
              console.error('Unknown timestamp format:', archivedAt);
              startTime = now;
            }
          } else if (typeof archivedAt === 'string') {
            startTime = Date.parse(archivedAt);
          } else if (typeof archivedAt === 'number') {
            startTime = archivedAt;
          } else {
            console.error('Invalid archivedAt type:', typeof archivedAt);
            startTime = now;
          }
          
          if (isNaN(startTime)) {
            console.error('Invalid archivedAt timestamp:', archivedAt);
            startTime = now; // Fallback to current time
          }
        } catch (error) {
          console.error('Error parsing archivedAt:', error);
          startTime = now; // Fallback to current time
        }
        duration = 7 * 24 * 60 * 60 * 1000; // 7 days for archived listings
      } else {
        // For active listings, use createdAt and tier duration
        try {
          if (createdAt instanceof Date) {
            startTime = createdAt.getTime();
          } else if (typeof createdAt === 'object' && createdAt._seconds) {
            // Handle Firestore Timestamp
            startTime = createdAt._seconds * 1000;
          } else if (typeof createdAt === 'string') {
            startTime = Date.parse(createdAt);
          } else {
            startTime = Number(createdAt);
          }
          
          if (isNaN(startTime)) {
            console.error('Invalid createdAt timestamp:', createdAt);
            startTime = now; // Fallback to current time
          }
        } catch (error) {
          console.error('Error parsing createdAt:', error);
          startTime = now; // Fallback to current time
        }
        duration = ACCOUNT_TIERS[accountTier].listingDuration * 60 * 60 * 1000;
      }
      
      const elapsed = now - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progressValue = ((duration - remaining) / duration) * 100;
      
      setTimeLeft(remaining);
      setProgress(progressValue);

      // Only set UI state to expired, but don't trigger cleanup automatically
      // The server-side cron job will handle the actual archiving/deletion
      if (remaining === 0) {
        setIsExpired(true);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [createdAt, archivedAt, accountTier, status]);

  const formatTimeLeft = () => {
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  if (isExpired && status === 'active') {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isProcessing ? "Processing..." : "Listing expired"}
          </AlertDescription>
        </Alert>
        <div className="h-2 w-full bg-red-500 rounded-full" />
        {!isProcessing && listingId && (
          <button 
            onClick={triggerManualCleanup}
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
          >
            Click to refresh status
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {status === 'active' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {accountTier === 'free' ? 
              `Free plan: Listing expires in ${formatTimeLeft()}` :
              `Listing expires in ${formatTimeLeft()}`}
          </AlertDescription>
        </Alert>
      )}
      {status === 'archived' && archivedAt && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Archived: Will be deleted in {formatTimeLeft()}
          </AlertDescription>
        </Alert>
      )}
      <div className="h-2 w-full bg-red-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${100 - progress}%` }}
        />
      </div>
    </div>
  );
}