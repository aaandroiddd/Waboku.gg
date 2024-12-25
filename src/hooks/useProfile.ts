import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserProfile {
  id: string;
  username: string;
  joinDate: string;
  location?: string;
  totalSales?: number;
  rating?: number;
  bio?: string;
  avatarUrl?: string;
  email: string;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        setError(null);

        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (!userDoc.exists()) {
          if (isMounted) {
            setError('Profile not found');
            setProfile(null);
          }
          return;
        }

        const userData = userDoc.data();
        const profileData: UserProfile = {
          id: userDoc.id,
          username: userData.username || 'Anonymous User',
          email: userData.email,
          joinDate: userData.createdAt || new Date().toISOString(),
          location: userData.location,
          totalSales: userData.totalSales || 0,
          rating: userData.rating || 0,
          bio: userData.bio,
          avatarUrl: userData.avatarUrl || '/images/rect.png'
        };

        if (isMounted) {
          setProfile(profileData);
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