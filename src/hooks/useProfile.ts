import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { UserProfile } from '@/types/database';

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setIsLoading(false);
        setProfile(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // First try to get the user document
        const userDoc = await getDoc(doc(firebaseDb, 'users', userId));
        const userData = userDoc.data();
        
        // Create a default profile even if the document doesn't exist
        const profileData: UserProfile = {
          uid: userId,
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
          } : null
        };
        setProfile(profileData);
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