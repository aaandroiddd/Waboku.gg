import React, { useEffect, useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/useProfile';
import { User } from 'firebase/auth';
import { getBestAvatarUrl, getGoogleAvatarSizes } from '@/lib/avatar-utils';

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
  
  // Get the best quality avatar URL using the new utility
  const avatarSrc = getBestAvatarUrl(user, profile);
  
  // Get responsive sizes for Google photos
  const avatarSizes = getGoogleAvatarSizes(avatarSrc);
  
  // Choose appropriate size based on component size
  const getSizedAvatarUrl = () => {
    if (!avatarSrc) return undefined;
    
    switch (size) {
      case 'sm':
        return avatarSizes.small;
      case 'md':
        return avatarSizes.medium;
      case 'lg':
        return avatarSizes.large;
      case 'xl':
        return avatarSizes.xlarge;
      default:
        return avatarSizes.medium;
    }
  };
  
  const finalAvatarSrc = getSizedAvatarUrl();
  
  // Log avatar source for debugging
  useEffect(() => {
    console.log('ProfileAvatar - Avatar source:', {
      profileAvatarUrl: profile?.avatarUrl,
      userPhotoURL: user?.photoURL,
      bestAvatarUrl: avatarSrc,
      finalSizedUrl: finalAvatarSrc,
      size: size,
      availableSizes: avatarSizes
    });
  }, [profile?.avatarUrl, user?.photoURL, avatarSrc, finalAvatarSrc, size, avatarSizes]);
  
  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20',
  };
  
  // Get initials for fallback
  const getInitials = () => {
    // Safely check if profile exists and has username
    if (profile?.username && typeof profile.username === 'string' && profile.username.length > 0) {
      return profile.username.charAt(0).toUpperCase();
    }
    // Safely check if user has displayName
    if (user?.displayName && typeof user.displayName === 'string' && user.displayName.length > 0) {
      return user.displayName.charAt(0).toUpperCase();
    }
    // Safely check if user has email
    if (user?.email && typeof user.email === 'string' && user.email.length > 0) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage 
        key={avatarKey} // Force re-render when avatar changes
        src={finalAvatarSrc} 
        alt={profile?.username || user?.displayName || 'User avatar'} 
        onError={(e) => {
          // If high-quality avatar fails to load, try the original URL
          const target = e.target as HTMLImageElement;
          
          if (finalAvatarSrc !== avatarSrc && avatarSrc) {
            console.log('High-quality avatar failed to load, trying original URL');
            target.src = avatarSrc;
          } else if (user?.photoURL && finalAvatarSrc !== user.photoURL) {
            console.log('Avatar failed to load, trying user photoURL');
            target.src = user.photoURL;
          } else {
            console.log('Avatar failed to load, using default');
            target.src = '/images/default-avatar.svg';
            // Also refresh profile data for next time
            refreshProfile();
          }
        }}
      />
      <AvatarFallback>{getInitials()}</AvatarFallback>
    </Avatar>
  );
}