import Link from 'next/link';
import { useUserData, prefetchUserData } from '@/hooks/useUserData';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { getFirebaseServices, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, get } from 'firebase/database';

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
      if (userData?.username && userData.username !== 'Unknown User') {
        // We have valid username data, use it
        setDisplayName(userData.username);
      } else if (initialUsername) {
        // If we have initialUsername, always prefer that over anything else
        setDisplayName(initialUsername);
      } else if (displayName === 'Loading user...' || displayName === 'Unknown User') {
        // Only set to fallback if we don't have anything better
        if (localStorage.getItem(`username_${userId}`)) {
          // Try local storage as a last resort
          setDisplayName(localStorage.getItem(`username_${userId}`)!);
        } else {
          // Look for email in Firebase and use it as a fallback
          fetchEmailAsUsername(userId);
        }
      }
    }
  }, [loading, userData, initialUsername, displayName, userId]);
  
  // Function to try to get a username from email or any available user data
  const fetchEmailAsUsername = async (userId: string) => {
    try {
      // Always try Firestore first for consistent user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        // Try to get username from various fields
        if (data.username) {
          setDisplayName(data.username);
          localStorage.setItem(`username_${userId}`, data.username);
          return;
        } else if (data.displayName) {
          setDisplayName(data.displayName);
          localStorage.setItem(`username_${userId}`, data.displayName);
          return;
        } else if (data.email) {
          // Get username part from email (before the @)
          const emailMatch = data.email.match(/^([^@]+)@/);
          if (emailMatch && emailMatch[1]) {
            const usernameFromEmail = emailMatch[1];
            setDisplayName(usernameFromEmail);
            localStorage.setItem(`username_${userId}`, usernameFromEmail);
            return;
          }
        }
        
        // If no usable fields found, fall back to truncated ID
        const truncatedId = userId.length > 10 ? `${userId.substring(0, 6)}...` : userId;
        setDisplayName(`User ${truncatedId}`);
      } else {
        // User not found in Firestore, use truncated ID
        const truncatedId = userId.length > 10 ? `${userId.substring(0, 6)}...` : userId;
        setDisplayName(`User ${truncatedId}`);
      }
    } catch (e) {
      console.warn('[UserNameLink] Error fetching username data:', e);
      // Fall back to user ID
      const truncatedId = userId.length > 10 ? `${userId.substring(0, 6)}...` : userId;
      setDisplayName(`User ${truncatedId}`);
    }
  };
  
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
