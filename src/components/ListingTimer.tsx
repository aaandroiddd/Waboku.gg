import { useEffect, useState, useCallback } from 'react';
import { Progress } from "@/components/ui/progress"
import { ACCOUNT_TIERS } from '@/types/account';
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/router';
import { useAccount } from '@/contexts/AccountContext';

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
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  // Get the current account tier from AccountContext to ensure we're using the most up-to-date information
  const { accountTier: currentAccountTier } = useAccount();
  
  // Use the current account tier from context, fallback to prop if context is not available
  const effectiveAccountTier = currentAccountTier || accountTier || 'free';

  // Track component mount state to prevent state updates on unmounted components
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Enhanced function to proactively handle expired listings
  const triggerManualCleanup = useCallback(async () => {
    if (isProcessing || !listingId || !isMounted) return;
    
    if (isMounted) setIsProcessing(true);
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
        if (isMounted) {
          toast({
            title: "Listing Archived",
            description: "The listing has been moved to archived status.",
            duration: 5000,
          });
        }
        
        // If we're on the listing page, redirect to listings
        if (router.pathname.includes('/listings/[id]')) {
          router.push('/listings');
        } else {
          // If we're on any other page, refresh to update the UI
          window.location.reload();
        }
      } else if (data.status === 'deleted' && status === 'archived') {
        if (isMounted) {
          toast({
            title: "Listing Deleted",
            description: "The archived listing has been permanently deleted.",
            duration: 5000,
          });
        }
        
        // Refresh the page to update the UI
        window.location.reload();
      }
    } catch (error) {
      console.error('Error triggering manual cleanup:', error);
      if (isMounted) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to process the listing. The system will automatically handle this soon.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } finally {
      if (isMounted) setIsProcessing(false);
    }
  }, [router, toast, isProcessing, status, listingId, isMounted]);

  // Add a state to track if we've initialized the timer
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Set a longer delay before initializing the timer to prevent showing expired state on initial load
    // This gives more time for data to be properly loaded and processed
    const initTimer = setTimeout(() => {
      if (isMounted) {
        setIsInitialized(true);
      }
    }, 1500);
    
    return () => clearTimeout(initTimer);
  }, [isMounted]);

  useEffect(() => {
    // Skip calculation until initialized
    if (!isInitialized || !isMounted) return;
    
    const calculateTimeLeft = () => {
      try {
        const now = Date.now();
        let startTime: number;
        let endTime: number;
        let duration: number;

        if (status === 'archived' && archivedAt) {
          // For archived listings, use archivedAt as start time and 7 days duration
          try {
            if (archivedAt instanceof Date) {
              startTime = archivedAt.getTime();
            } else if (typeof archivedAt === 'object' && archivedAt !== null) {
              // Handle Firestore Timestamp with toDate method
              if ('toDate' in archivedAt && typeof archivedAt.toDate === 'function') {
                startTime = archivedAt.toDate().getTime();
              }
              // Handle Firestore Timestamp with seconds and nanoseconds
              else if ('seconds' in archivedAt) {
                startTime = (archivedAt as any).seconds * 1000;
              } else if ('_seconds' in archivedAt) {
                startTime = (archivedAt as any)._seconds * 1000;
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
          endTime = startTime + duration;
        } else {
          // For active listings, first try to use the expiresAt field directly if available
          const expiresAt = (window as any).listingExpiresAt;
          
          if (expiresAt) {
            try {
              // Try to parse the expiresAt timestamp
              if (expiresAt instanceof Date) {
                endTime = expiresAt.getTime();
              } else if (typeof expiresAt === 'object' && expiresAt !== null) {
                // Handle Firestore Timestamp with toDate method
                if ('toDate' in expiresAt && typeof expiresAt.toDate === 'function') {
                  endTime = expiresAt.toDate().getTime();
                }
                // Handle Firestore Timestamp
                else if ('seconds' in expiresAt) {
                  endTime = (expiresAt as any).seconds * 1000;
                } else if ('_seconds' in expiresAt) {
                  endTime = (expiresAt as any)._seconds * 1000;
                } else {
                  console.error('Invalid expiresAt format:', expiresAt);
                  // Fall back to calculating from createdAt
                  endTime = 0; // This will trigger the fallback below
                }
              } else if (typeof expiresAt === 'string') {
                endTime = Date.parse(expiresAt);
              } else if (typeof expiresAt === 'number') {
                endTime = expiresAt;
              } else {
                console.error('Invalid expiresAt format:', expiresAt);
                // Fall back to calculating from createdAt
                endTime = 0; // This will trigger the fallback below
              }
              
              if (isNaN(endTime)) {
                console.error('Invalid expiresAt timestamp:', expiresAt);
                endTime = 0; // This will trigger the fallback below
              } else {
                console.log('Successfully parsed expiresAt:', new Date(endTime).toISOString());
              }
            } catch (error) {
              console.error('Error parsing expiresAt:', error);
              endTime = 0; // This will trigger the fallback below
            }
          } else {
            console.log('No expiresAt found, will calculate from createdAt');
            endTime = 0; // This will trigger the fallback below
          }
          
          // If we couldn't get a valid endTime from expiresAt, calculate it from createdAt
          if (endTime <= 0) {
            try {
              if (createdAt instanceof Date) {
                startTime = createdAt.getTime();
              } else if (typeof createdAt === 'object' && createdAt !== null) {
                // Handle Firestore Timestamp with toDate method
                if ('toDate' in createdAt && typeof createdAt.toDate === 'function') {
                  startTime = createdAt.toDate().getTime();
                }
                // Handle Firestore Timestamp
                else if ('seconds' in createdAt) {
                  startTime = (createdAt as any).seconds * 1000;
                } else if ('_seconds' in createdAt) {
                  startTime = (createdAt as any)._seconds * 1000;
                } else {
                  console.error('Invalid createdAt format:', createdAt);
                  startTime = now - 1000; // Fallback to current time minus 1 second
                }
              } else if (typeof createdAt === 'string') {
                startTime = Date.parse(createdAt);
              } else if (typeof createdAt === 'number') {
                startTime = createdAt;
              } else {
                console.error('Invalid createdAt format:', createdAt);
                startTime = now - 1000; // Fallback to current time minus 1 second
              }
              
              if (isNaN(startTime)) {
                console.error('Invalid createdAt timestamp:', createdAt);
                startTime = now - 1000; // Fallback to current time minus 1 second
              }
            } catch (error) {
              console.error('Error parsing createdAt:', error);
              startTime = now - 1000; // Fallback to current time minus 1 second
            }
            
            // Get the appropriate listing duration based on account tier
            // This ensures we're using the correct duration for the account tier
            // Free tier: 48 hours, Premium tier: 720 hours (30 days)
            duration = ACCOUNT_TIERS[effectiveAccountTier].listingDuration * 60 * 60 * 1000;
            console.log(`ListingTimer: Using account tier ${effectiveAccountTier} with duration ${ACCOUNT_TIERS[effectiveAccountTier].listingDuration} hours`);
            endTime = startTime + duration;
          }
          
          // Calculate duration based on start and end time
          // Make sure we have a valid startTime
          if (!startTime || isNaN(startTime)) {
            startTime = createdAt instanceof Date ? createdAt.getTime() : 
                       typeof createdAt === 'object' && createdAt !== null && ('toDate' in createdAt && typeof createdAt.toDate === 'function') ? 
                       createdAt.toDate().getTime() :
                       typeof createdAt === 'object' && createdAt !== null && ((createdAt as any).seconds || (createdAt as any)._seconds) ? 
                       ((createdAt as any).seconds || (createdAt as any)._seconds) * 1000 : 
                       typeof createdAt === 'string' ? Date.parse(createdAt) : 
                       typeof createdAt === 'number' ? createdAt : now - 1000;
          }
          
          // Debug log the time calculations
          console.log(`ListingTimer calculations for ${listingId || 'unknown'}:`, {
            now: new Date(now).toISOString(),
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            duration: duration / (60 * 60 * 1000) + ' hours',
            accountTier: effectiveAccountTier
          });
                     
          duration = endTime - startTime;
        }
        
        const elapsed = now - startTime;
        const remaining = Math.max(0, duration - elapsed);
        const progressValue = ((duration - remaining) / duration) * 100;
        
        // Only update state if component is still mounted
        if (isMounted) {
          setTimeLeft(remaining);
          setProgress(progressValue);

          // Only set UI state to expired, but don't trigger cleanup automatically
          // The server-side cron job will handle the actual archiving/deletion
          if (remaining === 0) {
            setIsExpired(true);
          }
        }
      } catch (error) {
        console.error('Error in ListingTimer calculateTimeLeft:', error);
        // Set safe fallback values if calculation fails
        if (isMounted) {
          setTimeLeft(0);
          setProgress(100);
          setIsExpired(true);
        }
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [createdAt, archivedAt, effectiveAccountTier, status, isInitialized, isMounted, listingId]);

  const formatTimeLeft = () => {
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else if (timeLeft > 0) {
      return '<1m';
    } else {
      return '0m';
    }
  };

  // When an archived timer runs out, we don't delete instantly on the client.
  // Deletion is handled by Firestore TTL and a backup cron that runs at :15 every 2 hours.
  // Show friendlier copy to avoid "0m" UX.
  const getNextCleanupText = useCallback(() => {
    try {
      const now = new Date();
      const candidate = new Date(now.getTime());
      // Next run is at minute 15 of the next even hour (00, 02, 04, ... 22)
      candidate.setMinutes(15, 0, 0);
      if (now.getMinutes() >= 15) {
        candidate.setHours(candidate.getHours() + 1);
      }
      if (candidate.getHours() % 2 !== 0) {
        candidate.setHours(candidate.getHours() + 1);
      }
      const timeStr = candidate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `during the next cleanup run (~${timeStr})`;
    } catch {
      return 'during the next cleanup run';
    }
  }, []);
  
  // Show a loading state while initializing
  if (!isInitialized) {
    return (
      <div className="flex flex-col gap-2">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Loading listing status...
          </AlertDescription>
        </Alert>
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '30%' }} />
        </div>
      </div>
    );
  }

  // Add a 5-minute buffer to prevent premature expiration display
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpiredWithBuffer = isExpired && timeLeft <= bufferTime;

  if (isExpiredWithBuffer && status === 'active') {
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
            {effectiveAccountTier === 'free' ? 
              `Free plan: Listing expires in ${formatTimeLeft()}` :
              `Listing expires in ${formatTimeLeft()}`}
          </AlertDescription>
        </Alert>
      )}
      {status === 'archived' && archivedAt && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {timeLeft > 0
              ? `Archived: Will be automatically deleted in ${formatTimeLeft()}`
              : `Archived: Scheduled for automatic deletion ${getNextCleanupText()}. No action is required.`}
          </AlertDescription>
        </Alert>
      )}
      {status === 'archived' && archivedAt && timeLeft === 0 && !isProcessing && listingId && (
        <button
          onClick={triggerManualCleanup}
          className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 self-start"
        >
          Click to refresh status
        </button>
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