import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

// Local cache for usernames to prevent "unknown user" flashes
const localUsernameCache: Record<string, { 
  username: string; 
  timestamp: number;
}> = {};

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showProfileOnClick?: boolean;
}

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = "", 
  showProfileOnClick = true 
}: UserNameLinkProps) {
  // Use local state to ensure consistent display even during loading
  const [displayName, setDisplayName] = useState<string>(
    // Try local cache first, then initialUsername, then placeholder
    localUsernameCache[userId]?.username || 
    initialUsername || 
    'Loading...'
  );
  
  // Initialize with cached data if available
  const initialData = initialUsername ? { username: initialUsername } : 
                     (localUsernameCache[userId]?.username ? { username: localUsernameCache[userId].username } : undefined);
  
  const { userData, loading, error } = useUserData(userId, initialData);
  
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
        // Ignore sessionStorage errors
      }
    }
  }, [userData, userId]);
  
  // Load from sessionStorage on mount
  useEffect(() => {
    // Only try to load from sessionStorage if we don't already have a value
    if (!localUsernameCache[userId]?.username && !displayName) {
      try {
        const existingCache = sessionStorage.getItem('usernameCache');
        if (existingCache) {
          const cacheObj = JSON.parse(existingCache);
          if (cacheObj[userId]?.username) {
            setDisplayName(cacheObj[userId].username);
            localUsernameCache[userId] = cacheObj[userId];
          }
        }
      } catch (e) {
        // Ignore sessionStorage errors
      }
    }
  }, [userId, displayName]);
  
  // Fallback handling - never show "Unknown User" if we have any alternative
  useEffect(() => {
    if (!loading && (!userData?.username || userData.username === 'Unknown User')) {
      // If we have initialUsername, use that instead of "Unknown User"
      if (initialUsername) {
        setDisplayName(initialUsername);
      } else if (displayName === 'Loading...') {
        // Only set to "Unknown User" if we don't have anything better
        setDisplayName('Unknown User');
      }
    }
  }, [loading, userData, initialUsername, displayName]);
  
  if (loading && displayName === 'Loading...') {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }
  
  if (showProfileOnClick) {
    return (
      <Link 
        href={`/profile/${userId}`} 
        className={`font-medium hover:underline ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {displayName}
      </Link>
    );
  }
  
  return <span className={`font-medium ${className}`}>{displayName}</span>;
}