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
        
        const profileDoc = await getDoc(doc(db, 'users', userId));
        
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          // Create a profile object with default values for missing fields
          const profileData: UserProfile = {
            uid: userId,
            username: data.username || 'Anonymous User',
            email: data.email || '',
            avatarUrl: data.avatarUrl || '',
            bio: data.bio || '',
            location: data.location || '',
            joinDate: data.joinDate || new Date().toISOString(),
            totalSales: data.totalSales || 0,
            rating: data.rating || 0,
            contact: data.contact || '',
            social: {
              youtube: data.social?.youtube || '',
              twitter: data.social?.twitter || '',
              facebook: data.social?.facebook || ''
            }
          };
          setProfile(profileData);
        } else {
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