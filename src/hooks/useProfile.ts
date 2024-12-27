import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage, initializationPromise } from '@/lib/firebase';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!isMounted || !mounted) return;

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
        // For demo purposes, return sample data for specific test IDs
        if (userId === 'demo-user-1') {
          if (isMounted && mounted) {
            setProfile({
              id: 'demo-user-1',
              username: 'CardMaster',
              joinDate: '2023-01-15T00:00:00Z',
              totalSales: 157,
              rating: 4.8,
              bio: 'Passionate card collector with over 10 years of experience. Specializing in rare Yu-Gi-Oh! and Magic: The Gathering cards.',
              avatarUrl: '/images/rect.png',
              location: 'New York, NY',
              contact: 'Available via messages',
              social: {
                youtube: 'https://youtube.com/@cardmaster',
                twitter: 'https://twitter.com/cardmaster',
              }
            });
            setError(null);
          }
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        // Wait for Firebase to initialize
        await initializationPromise;
        
        // Get user profile from Firestore
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        // Get username from usernames collection
        const usernameDocRef = doc(db, 'usernames', userId);
        const usernameDoc = await getDoc(usernameDocRef);
        
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