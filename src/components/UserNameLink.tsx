import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';
import { Skeleton } from './ui/skeleton';
import { useEffect, useState, useRef } from 'react';

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showSkeleton?: boolean;
}

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = '',
  showSkeleton = true
}: UserNameLinkProps) {
  const { userData, loading, error } = useUserData(userId);
  const [displayName, setDisplayName] = useState(initialUsername || 'Loading...');
  const [loadingState, setLoadingState] = useState<'initial' | 'loading' | 'success' | 'error'>(
    initialUsername ? 'success' : 'initial'
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout when component unmounts or dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId]);

  useEffect(() => {
    // Update loading state
    if (loading) {
      setLoadingState('loading');
    } else if (error) {
      setLoadingState('error');
    } else if (userData) {
      setLoadingState('success');
    }

    // Update display name based on available data
    if (userData?.username) {
      setDisplayName(userData.username);
    } else if (!loading && initialUsername) {
      setDisplayName(initialUsername);
    } else if (!loading && !userData?.username && !initialUsername) {
      // If we still don't have a username after loading completes
      setDisplayName('Unknown User');
    }
  }, [userData, loading, error, initialUsername]);

  // Show skeleton during initial loading if no initialUsername is provided
  if (loadingState === 'loading' && !initialUsername && showSkeleton) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }

  // If we don't have a valid userId, just show the name without a link
  if (!userId || userId === '') {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <Link
      href={`/profile/${userId}`}
      className={`hover:text-primary hover:underline transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {displayName}
    </Link>
  );
}