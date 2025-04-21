import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';
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
}

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = "", 
  showProfileOnClick = true 
}: UserNameLinkProps) {
  // Default to a better loading state that shows we're loading a specific user
  const defaultDisplayName = initialUsername || 
                            (localUsernameCache[userId]?.username) || 
                            `Loading user...`;
  
  // Use local state to ensure consistent display even during loading
  const [displayName, setDisplayName] = useState<string>(defaultDisplayName);
  
  // Initialize with cached data if available
  const initialData = initialUsername ? { username: initialUsername } : 
                     (localUsernameCache[userId]?.username ? { username: localUsernameCache[userId].username } : undefined);
  
  const { userData, loading, error } = useUserData(userId, initialData);
  
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
  
  // Fallback handling - never show "Unknown User" if we have any alternative
  useEffect(() => {
    if (!loading) {
      if (!userData) {
        // No user data available, but we might have initialUsername
        if (initialUsername && displayName !== initialUsername) {
          setDisplayName(initialUsername);
        } else if (displayName === 'Loading user...' || displayName === 'Unknown User') {
          // Use a more user-friendly fallback that doesn't say "Unknown User"
          setDisplayName(`User ${userId.substring(0, 6)}...`);
        }
      } else if (userData.username === 'Unknown User') {
        // If useUserData returned "Unknown User", try to use a better fallback
        if (initialUsername) {
          setDisplayName(initialUsername);
        } else {
          // Use a more user-friendly fallback
          setDisplayName(`User ${userId.substring(0, 6)}...`);
        }
      }
    }
  }, [loading, userData, initialUsername, displayName, userId]);
  
  // Show skeleton while loading, but only for a short time
  // to avoid flickering between "Loading..." and actual data
  if (loading && displayName === 'Loading user...') {
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
