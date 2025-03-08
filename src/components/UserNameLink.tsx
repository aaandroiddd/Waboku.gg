import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';
import { Skeleton } from './ui/skeleton';
import { useEffect, useState } from 'react';

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
}

export function UserNameLink({ userId, initialUsername, className = '' }: UserNameLinkProps) {
  const { userData, loading } = useUserData(userId);
  const [retryCount, setRetryCount] = useState(0);
  const [displayName, setDisplayName] = useState(initialUsername || 'Loading...');
  
  useEffect(() => {
    // Update display name when userData changes
    if (userData?.username) {
      setDisplayName(userData.username);
    } else if (!loading && !userData?.username && initialUsername) {
      setDisplayName(initialUsername);
    } else if (!loading && !userData?.username && !initialUsername) {
      // If we still don't have a username after loading, and no initial username was provided
      if (retryCount < 2) {
        // Retry fetching user data up to 2 times with increasing delays
        const timer = setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 1000 * (retryCount + 1));
        
        return () => clearTimeout(timer);
      } else {
        setDisplayName('Unknown User');
      }
    }
  }, [userData, loading, initialUsername, retryCount]);

  if (loading && !initialUsername) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }

  // If we don't have a valid userId, just show the name without a link
  if (!userId || userId === '') {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <Link
      href={`/profile/${userId}`}
      className={`hover:text-primary hover:underline ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {displayName}
    </Link>
  );
}