import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types/database';

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setError('Invalid user ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // First try to get the user document
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Create a profile object with data from the user document
          const profileData: UserProfile = {
            uid: userId,
            username: userData.displayName || userData.username || 'Anonymous User',
            email: userData.email || '',
            avatarUrl: userData.avatarUrl || userData.photoURL || null,
            bio: userData.bio || '',
            location: userData.location || '',
            joinDate: userData.createdAt || userData.joinDate || new Date().toISOString(),
            totalSales: typeof userData.totalSales === 'number' ? userData.totalSales : 0,
            rating: typeof userData.rating === 'number' ? userData.rating : null,
            contact: userData.contact || '',
            social: userData.social ? {
              youtube: userData.social.youtube || null,
              twitter: userData.social.twitter || null,
              facebook: userData.social.facebook || null
            } : null
          };
          setProfile(profileData);
        } else {
          // If no user document exists, try to get profile data from auth
          setError('Profile not found');
          setProfile(null);
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching profile');
        setProfile(null);
        console.error('Error fetching profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  return { profile, isLoading, error };
}