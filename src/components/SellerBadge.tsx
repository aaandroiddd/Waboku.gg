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
    if (user && !userId) {
      checkVerificationStatus();
    }
  }, [user, userId, checkVerificationStatus]);
  
  // Always use profile.isEmailVerified for consistency
  const isVerified = userId ? profile?.isEmailVerified : user?.emailVerified;
  
  return (
    <Badge 
      variant={isVerified ? "secondary" : "warning"}
      className={className}
    >
      {isVerified ? "Verified Seller" : "Unverified Seller"}
    </Badge>
  );
}