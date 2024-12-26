import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, initializationPromise } from '@/lib/firebase';

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
      if (!isMounted) return;

      // Reset states at the start of each fetch
      setIsLoading(true);
      setError(null);
      setProfile(null);

      // Validate userId
      if (!userId) {
        setIsLoading(false);
        setError('Invalid user ID');
        return;
      }

      try {
        // Wait for Firebase to initialize
        await initializationPromise;
        
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (!isMounted) return;

        if (!userDoc.exists()) {
          setError('Profile not found');
          setIsLoading(false);
          return;
        }

        const userData = userDoc.data();
        
        if (!userData) {
          setError('Invalid profile data');
          setIsLoading(false);
          return;
        }

        // Create a default date if createdAt is missing
        const defaultDate = new Date().toISOString();

        const profileData: UserProfile = {
          id: userDoc.id,
          username: userData.username || 'Anonymous User',
          email: userData.email,
          joinDate: userData.createdAt || defaultDate,
          location: userData.location,
          totalSales: Number(userData.totalSales) || 0,
          rating: userData.rating !== undefined ? Number(userData.rating) : undefined,
          bio: userData.bio,
          avatarUrl: userData.avatarUrl,
          contact: userData.contact,
          social: userData.social
        };

        if (isMounted) {
          setProfile(profileData);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        if (isMounted) {
          setError('Failed to load profile. Please try again later.');
        }
      } finally {
        if (isMounted) {
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