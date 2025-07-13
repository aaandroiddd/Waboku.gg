import Link from 'next/link';
import { useOptimizedUserData } from '@/hooks/useFirestoreOptimizer';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

// Local cache for usernames to prevent "unknown user" flashes
const localUsernameCache: Record<string, { 
  username: string; 
  timestamp: number;
}> = {};

// Cache expiration time (10 minutes)
const CACHE_EXPIRATION = 10 * 60 * 1000;

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showProfileOnClick?: boolean;
  isDeletedUser?: boolean; // New prop to indicate if this is a deleted user
}

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = "", 
  showProfileOnClick = true,
  isDeletedUser = false
}: UserNameLinkProps) {
  // Default to a better loading state that shows we're loading a specific user
  const defaultDisplayName = initialUsername || 
                            (localUsernameCache[userId]?.username) || 
                            `Loading user...`;
  
  // Use local state to ensure consistent display even during loading
  const [displayName, setDisplayName] = useState<string>(defaultDisplayName);
  
  // Use our optimized hook only if not a deleted user and if we have a valid userId
  // Also check if Firestore is available (it might be disabled on some pages like messages)
  const shouldFetchUserData = !isDeletedUser && userId && userId !== 'none';
  const { userData, loading } = useOptimizedUserData(shouldFetchUserData ? userId : null);
  
  // Load from sessionStorage on mount
  useEffect(() => {
    // Only try to load from sessionStorage if we don't already have a value
    if (!localUsernameCache[userId]?.username && displayName === defaultDisplayName) {
      try {
        const existingCache = sessionStorage.getItem('usernameCache');
        if (existingCache) {
          const cacheObj = JSON.parse(existingCache);
          if (cacheObj[userId]?.username && 
              Date.now() - cacheObj[userId].timestamp < CACHE_EXPIRATION) {
            setDisplayName(cacheObj[userId].username);
            localUsernameCache[userId] = cacheObj[userId];
          }
        }
      } catch (e) {
        console.warn('[UserNameLink] Error loading from sessionStorage:', e);
      }
    }
  }, [userId, displayName, defaultDisplayName]);
  
  // Update local state and cache when userData changes
  useEffect(() => {
    if (userData?.username && userData.username !== 'Unknown User') {
      // Update local state
      setDisplayName(userData.username);
      
      // Update local cache
      localUsernameCache[userId] = {
        username: userData.username,
        timestamp: Date.now()
      };
      
      // Also persist to sessionStorage for page refreshes
      try {
        const existingCache = sessionStorage.getItem('usernameCache');
        const cacheObj = existingCache ? JSON.parse(existingCache) : {};
        cacheObj[userId] = {
          username: userData.username,
          timestamp: Date.now()
        };
        sessionStorage.setItem('usernameCache', JSON.stringify(cacheObj));
      } catch (e) {
        console.warn('[UserNameLink] Error saving to sessionStorage:', e);
      }
    }
  }, [userData, userId]);
  
  // Update display name when userData changes
  useEffect(() => {
    if (userData) {
      setDisplayName(userData.username || initialUsername || `User ${userId.substring(0, 6)}...`);
    } else if (initialUsername) {
      setDisplayName(initialUsername);
    }
  }, [userData, initialUsername, userId]);
  
  // Show skeleton while loading, but only for a short time and not for deleted users
  // to avoid flickering between "Loading..." and actual data
  if (loading && displayName === 'Loading user...' && !isDeletedUser) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }
  
  if (showProfileOnClick) {
    // Only link to profile if we have a real username and the user is not deleted
    const isRealUsername = !displayName.startsWith('User ') || displayName === 'User';
    const canLinkToProfile = isRealUsername && !isDeletedUser;
    
    return (
      <Link 
        href={canLinkToProfile ? `/profile/${encodeURIComponent(displayName)}` : '#'} 
        className={`font-medium ${canLinkToProfile ? 'hover:underline' : 'cursor-default'} ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          
          // If it's not a real username or deleted user, show a message instead of navigating
          if (!canLinkToProfile) {
            e.preventDefault();
            alert('This user\'s profile is not available');
          }
        }}
      >
        {displayName}
      </Link>
    );
  }
  
  return <span className={`font-medium ${className}`}>{displayName}</span>;
}
