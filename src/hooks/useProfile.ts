import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { UserProfile } from '@/types/database';

// Cache to store profiles across component instances
const profileCache: Record<string, {
  profile: UserProfile;
  timestamp: number;
}> = {};

// Cache expiration time (2 minutes - reduced to ensure fresher data)
const CACHE_EXPIRATION = 2 * 60 * 1000;

// Function to check if there's a localStorage cache key for this profile
const checkLocalStorageCache = (userId: string): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const profileCacheKey = `profile_${userId}`;
    return localStorage.getItem(profileCacheKey) !== null;
  } catch (e) {
    console.warn('Error accessing localStorage:', e);
    return false;
  }
};

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(
    userId && profileCache[userId] ? profileCache[userId].profile : null
  );
  const [isLoading, setIsLoading] = useState(!profile);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if we have a valid cached profile and no localStorage flag to force refresh
      const cachedData = profileCache[id];
      const shouldForceRefresh = checkLocalStorageCache(id);
      
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRATION && !shouldForceRefresh) {
        setProfile(cachedData.profile);
        setIsLoading(false);
        return;
      }
      
      // Clear localStorage cache flag if it exists
      if (shouldForceRefresh && typeof window !== 'undefined') {
        try {
          const profileCacheKey = `profile_${id}`;
          localStorage.removeItem(profileCacheKey);
        } catch (e) {
          console.warn('Error clearing localStorage cache:', e);
        }
      }
      
      // First try to get the user document
      const userDoc = await getDoc(doc(firebaseDb, 'users', id));
      const userData = userDoc.data();
      
      // Create a default profile even if the document doesn't exist
      const profileData: UserProfile = {
        uid: id,
        username: userData?.username || userData?.displayName || 'Anonymous User',
        email: userData?.email || '',
        avatarUrl: userData?.avatarUrl || userData?.photoURL || null,
        bio: userData?.bio || '',
        location: userData?.location || '',
        joinDate: userData?.createdAt || userData?.joinDate || new Date().toISOString(),
        totalSales: typeof userData?.totalSales === 'number' ? userData.totalSales : 0,
        rating: typeof userData?.rating === 'number' ? userData.rating : null,
        contact: userData?.contact || '',
        social: userData?.social ? {
          youtube: userData.social.youtube || null,
          twitter: userData.social.twitter || null,
          facebook: userData.social.facebook || null
        } : null,
        tier: userData?.accountTier || userData?.tier || 'free',
        subscription: userData?.subscription || {
          currentPlan: 'free',
          status: 'inactive'
        }
      };
      
      // Log profile data for debugging
      console.log('Fetched profile data:', {
        uid: id,
        username: profileData.username,
        avatarUrl: profileData.avatarUrl,
        photoURL: userData?.photoURL,
        displayName: userData?.displayName
      });
      
      // Update the cache
      profileCache[id] = {
        profile: profileData,
        timestamp: Date.now()
      };
      
      setProfile(profileData);
    } catch (err: any) {
      setError(err.message || 'Error fetching profile');
      setProfile(null);
      console.error('Error fetching profile:', err);
      
      // Retry once after a short delay if it's a network error
      if (err.message?.includes('network') || err.code === 'unavailable') {
        setTimeout(() => {
          fetchProfile(id).catch(console.error);
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setProfile(null);
      return;
    }

    fetchProfile(userId);
    
    // Set up a refresh interval to keep profile data fresh
    const refreshInterval = setInterval(() => {
      if (userId) {
        // Check if we need to refresh based on cache expiration
        const cachedData = profileCache[userId];
        if (!cachedData || Date.now() - cachedData.timestamp >= CACHE_EXPIRATION) {
          console.log('Refreshing profile data due to cache expiration');
          fetchProfile(userId);
        }
      }
    }, CACHE_EXPIRATION / 2); // Refresh at half the cache expiration time
    
    return () => clearInterval(refreshInterval);
  }, [userId, fetchProfile]);

  // Function to force refresh the profile
  const refreshProfile = useCallback(() => {
    if (userId) {
      console.log('Forcing profile refresh for user:', userId);
      // Remove from cache to force a fresh fetch
      delete profileCache[userId];
      fetchProfile(userId);
    }
  }, [userId, fetchProfile]);

  return { profile, isLoading, error, refreshProfile };
}