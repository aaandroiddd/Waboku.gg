import Link from 'next/link';
import { useUserData, prefetchUserData } from '@/hooks/useUserData';
import { Skeleton } from './ui/skeleton';
import { useEffect, useState, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/router';

interface UserNameLinkProps {
  userId: string;
  initialUsername?: string;
  className?: string;
  showSkeleton?: boolean;
}

// Global cache for usernames to prevent "Unknown User" flashing
const usernameCache: Record<string, string> = {};

export function UserNameLink({ 
  userId, 
  initialUsername, 
  className = '',
  showSkeleton = true
}: UserNameLinkProps) {
  const router = useRouter();
  const { userData, loading, error } = useUserData(userId);
  
  // Initialize with cached value, initialUsername, or Loading state
  const [displayName, setDisplayName] = useState(() => {
    if (usernameCache[userId]) return usernameCache[userId];
    if (initialUsername) return initialUsername;
    return 'Loading...';
  });
  
  const [loadingState, setLoadingState] = useState<'initial' | 'loading' | 'success' | 'error'>(
    usernameCache[userId] || initialUsername ? 'success' : 'initial'
  );
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRIES = 3;
  const retryCountRef = useRef(0);
  const profileDataPreloaded = useRef(false);
  const isComponentMounted = useRef(true);

  // Directly fetch user data as a fallback when hook fails
  const fetchUserDirectly = useCallback(async () => {
    if (!userId || retryCountRef.current >= MAX_RETRIES || !isComponentMounted.current) return;
    
    try {
      retryCountRef.current += 1;
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && isComponentMounted.current) {
        const data = userDoc.data();
        const username = data.displayName || data.username || 'Unknown User';
        
        // Update global cache
        usernameCache[userId] = username;
        
        setDisplayName(username);
        setLoadingState('success');
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Direct fetch error for ${userId}:`, err);
      return false;
    }
  }, [userId]);

  // Prefetch user data immediately when component mounts
  useEffect(() => {
    if (userId && !usernameCache[userId] && !initialUsername) {
      // Use the batch prefetch function to efficiently load user data
      prefetchUserData([userId]).catch(err => {
        console.error(`Error prefetching data for ${userId}:`, err);
      });
      
      // Also try direct fetch as a backup
      fetchUserDirectly();
    }
    
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId, initialUsername, fetchUserDirectly]);

  useEffect(() => {
    // Reset retry count when userId changes
    retryCountRef.current = 0;
  }, [userId]);

  useEffect(() => {
    // Update loading state
    if (loading) {
      setLoadingState('loading');
    } else if (error) {
      setLoadingState('error');
      
      // If there's an error, try direct fetch as fallback
      if (userId && isComponentMounted.current) {
        timeoutRef.current = setTimeout(() => fetchUserDirectly(), 100);
      }
    } else if (userData) {
      setLoadingState('success');
    }

    // Update display name based on available data
    if (userData?.username) {
      // Update global cache
      usernameCache[userId] = userData.username;
      setDisplayName(userData.username);
    } else if (!loading && initialUsername) {
      // If we have an initialUsername and loading is complete, use it
      setDisplayName(initialUsername);
      // Also update cache with initialUsername if it's not "Unknown User"
      if (initialUsername !== 'Unknown User' && initialUsername !== 'Loading...') {
        usernameCache[userId] = initialUsername;
      }
    } else if (!loading && !userData?.username && !initialUsername) {
      // If we still don't have a username after loading completes
      // Try direct fetch as a fallback
      if (userId && (displayName === 'Loading...' || displayName === 'Unknown User') && isComponentMounted.current) {
        timeoutRef.current = setTimeout(() => fetchUserDirectly(), 100);
      } else if (displayName === 'Loading...' && isComponentMounted.current) {
        setDisplayName('Unknown User');
      }
    }
  }, [userData, loading, error, initialUsername, userId, displayName, fetchUserDirectly]);

  // Show skeleton during initial loading if no initialUsername is provided
  if (loadingState === 'loading' && !initialUsername && !usernameCache[userId] && showSkeleton) {
    return <Skeleton className="h-4 w-24 inline-block" />;
  }

  // If we don't have a valid userId, just show the name without a link
  if (!userId || userId === '') {
    return <span className={className}>{displayName}</span>;
  }

  // Preload profile data before navigation
  const preloadProfileData = async () => {
    if (profileDataPreloaded.current) return;
    
    try {
      profileDataPreloaded.current = true;
      
      // Ensure we have user data in localStorage cache
      if (typeof window !== 'undefined') {
        const profileCacheKey = `profile_${userId}`;
        
        // Check if we already have cached data
        if (!localStorage.getItem(profileCacheKey)) {
          // Fetch user data directly to ensure it's available
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Store actual user data in localStorage
            localStorage.setItem(profileCacheKey, JSON.stringify({
              username: data.displayName || data.username || 'Unknown User',
              avatarUrl: data.avatarUrl || data.photoURL || null,
              timestamp: Date.now()
            }));
          }
        }
      }
      
      // Also ensure we have the data in the global cache
      if (!usernameCache[userId]) {
        await fetchUserDirectly();
      }
    } catch (err) {
      console.error('Error preloading profile data:', err);
    }
  };

  // Handle click event safely to prevent the "event source is null" error
  const handleClick = async (e: React.MouseEvent) => {
    try {
      // Only stop propagation if the event exists and has a stopPropagation method
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      
      // Ensure profile data is preloaded
      await preloadProfileData();
      
      // Use router.push instead of relying on Link's default behavior
      e.preventDefault();
      router.push(`/profile/${userId}`);
    } catch (error) {
      console.error('Error handling click event:', error);
      
      // Fallback to direct navigation
      window.location.href = `/profile/${userId}`;
    }
  };

  // Preload data on hover
  const handleMouseEnter = () => {
    // Don't await this to keep hover responsive
    preloadProfileData().catch(err => {
      console.error('Error preloading on hover:', err);
    });
  };

  return (
    <Link
      href={`/profile/${userId}`}
      className={`hover:text-primary hover:underline transition-colors ${className}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      prefetch={false} // Disable Next.js prefetching to use our custom preloading
    >
      {displayName}
    </Link>
  );
}