import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/useProfile';
import { User } from 'firebase/auth';

interface ProfileAvatarProps {
  user: User | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function ProfileAvatar({ user, size = 'md', className = '' }: ProfileAvatarProps) {
  const { profile } = useProfile(user?.uid || null);
  
  // Determine avatar source with priority:
  // 1. Profile avatarUrl (from Firestore)
  // 2. User photoURL (from Firebase Auth)
  // 3. Default fallback
  const avatarSrc = profile?.avatarUrl || user?.photoURL || undefined;
  
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
      <AvatarImage src={avatarSrc} alt={profile?.username || user?.displayName || 'User avatar'} />
      <AvatarFallback>{getInitials()}</AvatarFallback>
    </Avatar>
  );
}