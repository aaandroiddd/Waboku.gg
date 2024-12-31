import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

interface SellerBadgeProps {
  className?: string;
  userId?: string;
}

export function SellerBadge({ className, userId }: SellerBadgeProps) {
  const { user, profile, checkVerificationStatus } = useAuth();
  
  useEffect(() => {
    if (user) {
      checkVerificationStatus();
    }
  }, [user, checkVerificationStatus]);
  
  // If viewing another user's profile, use their profile data
  // Otherwise, use the current user's verification status
  const isVerified = userId 
    ? profile?.isEmailVerified 
    : user?.emailVerified;
  
  if (!user && !userId) return null;
  
  return (
    <Badge 
      variant={isVerified ? "success" : "destructive"}
      className={className}
    >
      {isVerified ? "Verified Seller" : "Unverified Seller"}
    </Badge>
  );
}