import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { getFirebaseServices } from '@/lib/firebase';
import { CreditCard } from 'lucide-react';
import { BadgeTooltip } from '@/components/BadgeTooltip';

interface StripeSellerBadgeProps {
  className?: string;
  userId: string;
}

export function StripeSellerBadge({ className, userId }: StripeSellerBadgeProps) {
  const [hasStripeAccount, setHasStripeAccount] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (!userId) return;

    const { app } = getFirebaseServices();
    const firestore = getFirestore(app);
    const userDocRef = doc(firestore, 'users', userId);

    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      const data = doc.data();
      if (data) {
        // Check if the user has a Stripe Connect account
        // First check the new structure
        if (data.stripeConnectStatus === 'active' && data.stripeConnectAccountId) {
          setHasStripeAccount(true);
        } 
        // Fallback to the old structure if needed
        else if (data.stripeConnectAccount?.accountId && data.stripeConnectAccount?.status === 'active') {
          setHasStripeAccount(true);
        } else {
          setHasStripeAccount(false);
        }
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching user Stripe data:', error);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  if (isLoading || !hasStripeAccount) return null;

  return (
    <BadgeTooltip content="This seller has connected their Stripe account and can accept secure payments">
      <Badge 
        variant="secondary"
        className={`bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border-purple-500/20 inline-flex items-center text-xs max-w-full overflow-hidden ${className}`}
      >
        <CreditCard className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="truncate">Verified Seller</span>
      </Badge>
    </BadgeTooltip>
  );
}