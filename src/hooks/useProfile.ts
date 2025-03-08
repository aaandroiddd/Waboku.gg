import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { UserProfile } from '@/types/database';

// Cache to store profiles across component instances
const profileCache: Record<string, {
  profile: UserProfile;
  timestamp: number;
}> = {};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

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
      
      // Check if we have a valid cached profile
      const cachedData = profileCache[id];
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRATION) {
        setProfile(cachedData.profile);
        setIsLoading(false);
        return;
      }
      
      // First try to get the user document
      const userDoc = await getDoc(doc(firebaseDb, 'users', id));
      const userData = userDoc.data();
      
      // Create a default profile even if the document doesn't exist
      const profileData: UserProfile = {
        uid: id,
        username: userData?.displayName || userData?.username || 'Anonymous User',
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
  }, [userId, fetchProfile]);

  // Function to force refresh the profile
  const refreshProfile = useCallback(() => {
    if (userId) {
      // Remove from cache to force a fresh fetch
      delete profileCache[userId];
      fetchProfile(userId);
    }
  }, [userId, fetchProfile]);

  return { profile, isLoading, error, refreshProfile };
}