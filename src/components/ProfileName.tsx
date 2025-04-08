import React, { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { User } from 'firebase/auth';

interface ProfileNameProps {
  user: User | null;
  className?: string;
  fallback?: string;
}

export function ProfileName({ user, className = '', fallback = 'User' }: ProfileNameProps) {
  const { profile, refreshProfile, isLoading } = useProfile(user?.uid || null);
  const [displayName, setDisplayName] = useState<string>(fallback);
  
  // Force refresh when user or displayName changes
  useEffect(() => {
    if (user?.uid) {
      refreshProfile();
    }
  }, [user?.uid, user?.displayName, refreshProfile]);
  
  // Update display name when user or profile changes
  useEffect(() => {
    if (user) {
      // Priority order: profile username > user displayName > user email > fallback
      const name = profile?.username || 
                  user.displayName || 
                  (user.email ? user.email.split('@')[0] : fallback);
      setDisplayName(name);
    } else {
      setDisplayName(fallback);
    }
    
    // Log username for debugging
    console.log('ProfileName - Display name:', {
      profileUsername: profile?.username,
      userDisplayName: user?.displayName,
      userEmail: user?.email,
      isLoading,
      finalName: profile?.username || user?.displayName || (user?.email ? user.email.split('@')[0] : fallback)
    });
  }, [profile, user, fallback, isLoading]);
  
  return (
    <span className={className}>
      {displayName}
    </span>
  );
}