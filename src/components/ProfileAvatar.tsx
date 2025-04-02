import React, { useEffect, useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/useProfile';
import { User } from 'firebase/auth';

interface ProfileAvatarProps {
  user: User | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function ProfileAvatar({ user, size = 'md', className = '' }: ProfileAvatarProps) {
  const { profile, refreshProfile } = useProfile(user?.uid || null);
  const [avatarKey, setAvatarKey] = useState<number>(Date.now());
  
  // Force refresh when user or photoURL changes
  useEffect(() => {
    if (user?.uid) {
      refreshProfile();
      setAvatarKey(Date.now()); // Force re-render of avatar
    }
  }, [user?.uid, user?.photoURL, refreshProfile]);
  
  // Determine avatar source with priority:
  // 1. Profile avatarUrl (from Firestore)
  // 2. User photoURL (from Firebase Auth)
  // 3. Default fallback
  const avatarSrc = profile?.avatarUrl || user?.photoURL || undefined;
  
  // Log avatar source for debugging
  useEffect(() => {
    console.log('ProfileAvatar - Avatar source:', {
      profileAvatarUrl: profile?.avatarUrl,
      userPhotoURL: user?.photoURL,
      finalSrc: avatarSrc
    });
  }, [profile?.avatarUrl, user?.photoURL, avatarSrc]);
  
  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20',
  };
  
  // Get initials for fallback
  const getInitials = () => {
    if (profile?.username) {
      return profile.username.charAt(0).toUpperCase();
    }
    if (user?.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage 
        key={avatarKey} // Force re-render when avatar changes
        src={avatarSrc} 
        alt={profile?.username || user?.displayName || 'User avatar'} 
        onError={(e) => {
          // If avatar fails to load, try to refresh profile data
          console.log('Avatar failed to load, refreshing profile');
          refreshProfile();
          
          // Set fallback image
          const target = e.target as HTMLImageElement;
          target.src = '/images/default-avatar.svg';
        }}
      />
      <AvatarFallback>{getInitials()}</AvatarFallback>
    </Avatar>
  );
}