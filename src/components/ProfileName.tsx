import React, { useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { User } from 'firebase/auth';

interface ProfileNameProps {
  user: User | null;
  className?: string;
  fallback?: string;
}

export function ProfileName({ user, className = '', fallback = 'User' }: ProfileNameProps) {
  const { profile, refreshProfile } = useProfile(user?.uid || null);
  
  // Force refresh when user or displayName changes
  useEffect(() => {
    if (user?.uid) {
      refreshProfile();
    }
  }, [user?.uid, user?.displayName, refreshProfile]);
  
  // Determine display name with priority:
  // 1. Profile username (from Firestore)
  // 2. User displayName (from Firebase Auth)
  // 3. Fallback value
  const displayName = profile?.username || user?.displayName || fallback;
  
  // Log username for debugging
  useEffect(() => {
    console.log('ProfileName - Display name:', {
      profileUsername: profile?.username,
      userDisplayName: user?.displayName,
      finalName: displayName
    });
  }, [profile?.username, user?.displayName, displayName]);
  
  return (
    <span className={className}>
      {displayName}
    </span>
  );
}