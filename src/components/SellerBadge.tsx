import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { AccountTier, ACCOUNT_TIERS } from '@/types/account';
import { Badge } from '@/components/ui/badge';
import { getFirebaseServices } from '@/lib/firebase';

interface SellerBadgeProps {
  className?: string;
  userId?: string;
  showOnlyOnProfile?: boolean;
}

interface UserData {
  isEmailVerified: boolean;
  accountTier: AccountTier;
  subscription?: {
    status: string;
    endDate?: string;
  };
}

export function SellerBadge({ className, userId, showOnlyOnProfile = false }: SellerBadgeProps) {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  
  useEffect(() => {
    if (!userId) return;

    const { app } = getFirebaseServices();
    const firestore = getFirestore(app);
    const userDocRef = doc(firestore, 'users', userId);

    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      const data = doc.data();
      if (data) {
        setUserData({
          isEmailVerified: data.isEmailVerified === true,
          accountTier: data.accountTier || 'free',
          subscription: data.subscription
        });
      } else {
        setUserData(null);
      }
    }, (error) => {
      console.error('Error fetching user data:', error);
      setUserData(null);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  if (!userData || !userId) return null;

  // Check if premium is active
  const isPremiumActive = userData.accountTier === 'premium' && 
    (!userData.subscription?.endDate || new Date(userData.subscription.endDate) > new Date());
  
  return (
    <div className="flex gap-2">
      {userData.isEmailVerified && (
        <Badge 
          variant="secondary"
          className="bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1"
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          Verified
        </Badge>
      )}
      {isPremiumActive ? (
        <Badge 
          variant="secondary"
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-none"
        >
          ⭐ Premium
        </Badge>
      ) : (
        <Badge 
          variant="secondary"
          className="bg-gray-500/10 hover:bg-gray-500/20 text-gray-500 border-gray-500/20"
        >
          Free User
        </Badge>
      )}
    </div>
  );
}