import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface SellerBadgeProps {
  className?: string;
}

export function SellerBadge({ className }: SellerBadgeProps) {
  const { isEmailVerified } = useAuth();
  
  return (
    <Badge 
      variant={isEmailVerified() ? "secondary" : "destructive"}
      className={className}
    >
      {isEmailVerified() ? "Verified Seller" : "Unverified Seller"}
    </Badge>
  );
}