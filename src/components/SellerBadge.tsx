import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface SellerBadgeProps {
  className?: string;
  userId?: string;
}

export function SellerBadge({ className, userId }: SellerBadgeProps) {
  const { user, profile } = useAuth();
  
  // If userId is provided, we're viewing someone else's profile
  // If not, we're viewing our own profile
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