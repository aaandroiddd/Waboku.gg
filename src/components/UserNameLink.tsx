import Link from 'next/link';
import { useUserData } from '@/hooks/useUserData';
import { Skeleton } from './ui/skeleton';
import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  const { userData, loading, error } = useUserData(userId);
  const [displayName, setDisplayName] = useState(initialUsername || 'Loading...');
  const [loadingState, setLoadingState] = useState<'initial' | 'loading' | 'success' | 'error'>(
    initialUsername ? 'success' : 'initial'
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRIES = 3;
  const retryCountRef = useRef(0);
  const profileDataPreloaded = useRef(false);

  // Directly fetch user data as a fallback when hook fails
  const fetchUserDirectly = async () => {
    if (!userId || retryCountRef.current >= MAX_RETRIES) return;
    
    try {
      retryCountRef.current += 1;
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const username = data.displayName || data.username || 'Unknown User';
        setDisplayName(username);
        setLoadingState('success');
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Direct fetch error for ${userId}:`, err);
      return false;
    }
  };

  useEffect(() => {
    // Reset retry count when userId changes
    retryCountRef.current = 0;
    
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
      
      // If there's an error, try direct fetch as fallback
      if (userId) {
        timeoutRef.current = setTimeout(() => fetchUserDirectly(), 500);
      }
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
      // Try direct fetch as a fallback
      if (userId && (displayName === 'Loading...' || displayName === 'Unknown User')) {
        timeoutRef.current = setTimeout(() => fetchUserDirectly(), 500);
      } else {
        setDisplayName('Unknown User');
      }
    }
  }, [userData, loading, error, initialUsername, userId, displayName]);

  // Show skeleton during initial loading if no initialUsername is provided
  if (loadingState === 'loading' && !initialUsername && showSkeleton) {
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
            // Store minimal data in localStorage to indicate we've prefetched
            localStorage.setItem(profileCacheKey, JSON.stringify({
              prefetched: true,
              timestamp: Date.now()
            }));
          }
        }
      }
    } catch (err) {
      console.error('Error preloading profile data:', err);
    }
  };

  // Handle click event safely to prevent the "event source is null" error
  const handleClick = async (e: React.MouseEvent | null) => {
    // Only stop propagation if the event exists and has a stopPropagation method
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    
    // Ensure profile data is preloaded
    await preloadProfileData();
  };

  // Preload data on hover
  const handleMouseEnter = () => {
    preloadProfileData();
  };

  return (
    <Link
      href={`/profile/${userId}`}
      className={`hover:text-primary hover:underline transition-colors ${className}`}
      onClick={(e) => {
        try {
          // Handle the click event
          handleClick(e);
        } catch (error) {
          console.error('Error handling click event:', error);
          // Prevent default behavior if there's an error
          if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
          }
          
          // Ensure profile data is preloaded before navigation
          preloadProfileData().then(() => {
            // Navigate programmatically as a fallback
            window.location.href = `/profile/${userId}`;
          });
        }
      }}
      onMouseEnter={handleMouseEnter}
      prefetch={false} // Disable Next.js prefetching to use our custom preloading
    >
      {displayName}
    </Link>
  );
}