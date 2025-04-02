import React from 'react';
import { useProfile } from '@/hooks/useProfile';
import { User } from 'firebase/auth';

interface ProfileNameProps {
  user: User | null;
  className?: string;
  fallback?: string;
}

export function ProfileName({ user, className = '', fallback = 'User' }: ProfileNameProps) {
  const { profile } = useProfile(user?.uid || null);
  
  // Determine display name with priority:
  // 1. Profile username (from Firestore)
  // 2. User displayName (from Firebase Auth)
  // 3. Fallback value
  const displayName = profile?.username || user?.displayName || fallback;
  
  return (
    <span className={className}>
      {displayName}
    </span>
  );
}