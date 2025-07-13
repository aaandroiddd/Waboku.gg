import Link from 'next/link';
import { useOptimizedUserData } from '@/hooks/useFirestoreOptimizer';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { getFirebaseServices } from '@/lib/firebase';
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
  const [isFirestoreDisabled, setIsFirestoreDisabled] = useState<boolean>(false);
  
  // Check if Firestore is disabled
  useEffect(() => {
    const checkFirestoreStatus = async () => {
      try {
        const { db } = getFirebaseServices();
        if (!db) {
          setIsFirestoreDisabled(true);
          return;
        }
        
        // Try to access Firestore to see if it's disabled
        // This is a simple way to detect if FirestoreDisabler has been used
        const firestoreDisabled = localStorage.getItem('firestore_disabled') === 'true';
        setIsFirestoreDisabled(firestoreDisabled);
      } catch (error) {
        console.warn('[UserNameLink] Firestore appears to be disabled:', error);
        setIsFirestoreDisabled(true);
      }
    };
    
    checkFirestoreStatus();
  }, []);
  
  // Use our optimized hook only if not a deleted user, valid userId, and Firestore is available
  const shouldFetchUserData = !isDeletedUser && userId && userId !== 'none' && !isFirestoreDisabled;
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
  
  // Update local state and cache when userData changes (only if Firestore is enabled)
  useEffect(() => {
    if (!isFirestoreDisabled && userData?.username && userData.username !== 'Unknown User') {
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
  }, [userData, userId, isFirestoreDisabled]);
  
  // Fallback to Realtime Database when Firestore is disabled
  useEffect(() => {
    if (isFirestoreDisabled && userId && userId !== 'none' && !isDeletedUser) {
      // Check if we already have cached data
      if (localUsernameCache[userId]?.username && 
          Date.now() - localUsernameCache[userId].timestamp < CACHE_EXPIRATION) {
        setDisplayName(localUsernameCache[userId].username);
        return;
      }
      
      // Fetch from Realtime Database
      const fetchFromRealtimeDB = async () => {
        try {
          const { database } = getFirebaseServices();
          if (!database) {
            console.warn('[UserNameLink] Realtime Database not available');
            return;
          }
          
          const userRef = ref(database, `users/${userId}`);
          const userSnapshot = await get(userRef);
          
          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            const username = userData.displayName || userData.username || userData.email?.split('@')[0] || `User ${userId.substring(0, 8)}`;
            
            // Update display name
            setDisplayName(username);
            
            // Update cache
            localUsernameCache[userId] = {
              username: username,
              timestamp: Date.now()
            };
            
            // Also persist to sessionStorage
            try {
              const existingCache = sessionStorage.getItem('usernameCache');
              const cacheObj = existingCache ? JSON.parse(existingCache) : {};
              cacheObj[userId] = {
                username: username,
                timestamp: Date.now()
              };
              sessionStorage.setItem('usernameCache', JSON.stringify(cacheObj));
            } catch (e) {
              console.warn('[UserNameLink] Error saving to sessionStorage:', e);
            }
            
            console.log(`[UserNameLink] Fetched username from Realtime DB: ${username}`);
          } else {
            // User not found, use fallback
            const fallbackUsername = `User ${userId.substring(0, 8)}`;
            setDisplayName(fallbackUsername);
            
            // Cache with shorter expiration
            localUsernameCache[userId] = {
              username: fallbackUsername,
              timestamp: Date.now() - (CACHE_EXPIRATION / 2)
            };
          }
        } catch (error) {
          console.error('[UserNameLink] Error fetching from Realtime Database:', error);
          const fallbackUsername = `User ${userId.substring(0, 8)}`;
          setDisplayName(fallbackUsername);
        }
      };
      
      fetchFromRealtimeDB();
    }
  }, [isFirestoreDisabled, userId, isDeletedUser]);
  
  // Update display name when userData changes (from Firestore) - but only if Firestore is enabled
  useEffect(() => {
    // Only update from Firestore data if Firestore is not disabled
    if (!isFirestoreDisabled && userData) {
      setDisplayName(userData.username || initialUsername || `User ${userId.substring(0, 6)}...`);
    } else if (!isFirestoreDisabled && initialUsername && !userData) {
      setDisplayName(initialUsername);
    }
    // If Firestore is disabled, don't override the display name that was set by Realtime Database
  }, [userData, initialUsername, userId, isFirestoreDisabled]);
  
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
