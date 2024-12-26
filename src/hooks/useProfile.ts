import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserProfile {
  id: string;
  username: string;
  joinDate: string;
  totalSales?: number;
  rating?: number;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  contact?: string;
  location?: string;
  social?: {
    youtube?: string;
    twitter?: string;
    facebook?: string;
  };
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      // Reset states at the start of each fetch
      if (isMounted) {
        setIsLoading(true);
        setError(null);
        setProfile(null);
      }

      // Validate userId
      if (!userId) {
        if (isMounted) {
          setIsLoading(false);
          setError('Invalid user ID');
        }
        return;
      }
      
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          if (isMounted) {
            setError('Profile not found');
            setIsLoading(false);
          }
          return;
        }

        const userData = userDoc.data();
        
        // Validate required data
        if (!userData) {
          if (isMounted) {
            setError('Invalid profile data');
            setIsLoading(false);
          }
          return;
        }

        const profileData: UserProfile = {
          id: userDoc.id,
          username: userData.username || 'Anonymous User',
          email: userData.email || undefined,
          joinDate: userData.createdAt || new Date().toISOString(),
          location: userData.location || undefined,
          totalSales: typeof userData.totalSales === 'number' ? userData.totalSales : 0,
          rating: typeof userData.rating === 'number' ? userData.rating : undefined,
          bio: userData.bio || undefined,
          avatarUrl: userData.avatarUrl || undefined,
          contact: userData.contact || undefined,
          social: userData.social || undefined
        };

        if (isMounted) {
          setProfile(profileData);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        if (isMounted) {
          setError('Failed to load profile');
          setProfile(null);
          setIsLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { profile, isLoading, error };
}