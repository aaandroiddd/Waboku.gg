import Link from 'next/link';
import { useOptimizedUserData } from '@/hooks/useFirestoreOptimizer';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { getUserDisplayInfo, UserDisplayInfo } from '@/lib/deleted-user-handler';

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showProfileOnClick?: boolean;
  isDeletedUser?: boolean; // Deprecated - will be auto-detected
}

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = "", 
  showProfileOnClick = true,
  isDeletedUser = false // Keep for backward compatibility but will be overridden
}: UserNameLinkProps) {
  const [displayInfo, setDisplayInfo] = useState<UserDisplayInfo>({
    displayName: initialUsername || 'Loading...',
    isDeleted: isDeletedUser,
    canLinkToProfile: false
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Use optimized hook to get current user data
  const { userData, loading: userDataLoading } = useOptimizedUserData(userId && userId !== 'none' ? userId : null);
  
  // Get display information using the new deleted user handler
  useEffect(() => {
    const getDisplayInfo = async () => {
      if (!userId || userId === 'none') {
        setDisplayInfo({
          displayName: 'Unknown User',
          isDeleted: true,
          canLinkToProfile: false
        });
        setIsLoading(false);
        return;
      }

      try {
        const info = await getUserDisplayInfo(userId, initialUsername, userData);
        setDisplayInfo(info);
      } catch (error) {
        console.error('[UserNameLink] Error getting display info:', error);
        // Fallback to safe display
        setDisplayInfo({
          displayName: initialUsername || 'Unknown User',
          isDeleted: false,
          canLinkToProfile: false
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we don't have user data loading or if user data loading is complete
    if (!userDataLoading) {
      getDisplayInfo();
    }
  }, [userId, initialUsername, userData, userDataLoading]);

  // Show skeleton while loading
  if (isLoading || (userDataLoading && displayInfo.displayName === 'Loading...')) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }
  
  if (showProfileOnClick) {
    return (
      <Link 
        href={displayInfo.canLinkToProfile ? `/profile/${encodeURIComponent(displayInfo.displayName)}` : '#'} 
        className={`font-medium ${
          displayInfo.canLinkToProfile 
            ? 'hover:underline text-primary' 
            : 'cursor-default text-muted-foreground'
        } ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          
          // If it's not a real username or deleted user, show a message instead of navigating
          if (!displayInfo.canLinkToProfile) {
            e.preventDefault();
            if (displayInfo.isDeleted) {
              alert('This user account has been deleted and their profile is no longer available.');
            } else {
              alert('This user\'s profile is not available.');
            }
          }
        }}
      >
        {displayInfo.displayName}
      </Link>
    );
  }
  
  return (
    <span className={`font-medium ${displayInfo.isDeleted ? 'text-muted-foreground' : ''} ${className}`}>
      {displayInfo.displayName}
    </span>
  );
}
