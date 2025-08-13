import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';
import { BadgeTooltip } from '@/components/BadgeTooltip';
import { useStripeVerifiedUser } from '@/hooks/useStripeVerifiedUser';

interface StripeSellerBadgeProps {
  className?: string;
  userId: string;
}

export function StripeSellerBadge({ className, userId }: StripeSellerBadgeProps) {
  const { isVerified, loading } = useStripeVerifiedUser(userId);
  
  // Show skeleton loader while loading
  if (loading) {
    return (
      <Badge 
        variant="secondary"
        className={`bg-purple-500/10 hover:bg-purple-500/20 text-purple-500/50 border-purple-500/20 inline-flex items-center text-xs max-w-full overflow-hidden animate-pulse ${className}`}
      >
        <CreditCard className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="truncate">Stripe Seller</span>
      </Badge>
    );
  }

  // Hide badge if the seller is not Stripe-verified
  if (!isVerified) return null;

  return (
    <BadgeTooltip content="This seller has connected their Stripe account, verified their identity, and can accept secure payments">
      <Badge 
        variant="secondary"
        className={`bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border-purple-500/20 inline-flex items-center text-xs max-w-full overflow-hidden ${className}`}
      >
        <CreditCard className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="truncate">Stripe Seller</span>
      </Badge>
    </BadgeTooltip>
  );
}