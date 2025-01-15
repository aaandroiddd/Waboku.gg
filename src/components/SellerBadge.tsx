import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { AccountTier, ACCOUNT_TIERS } from '@/types/account';
import { Badge } from '@/components/ui/badge';

interface SellerBadgeProps {
  className?: string;
  userId?: string;
  showOnlyOnProfile?: boolean;
}

interface UserData {
  isEmailVerified: boolean;
  accountTier: AccountTier;
}

export function SellerBadge({ className, userId, showOnlyOnProfile = false }: SellerBadgeProps) {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (userId) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData({
              isEmailVerified: data.isEmailVerified === true,
              accountTier: data.accountTier || 'free'
            });
          } else {
            setUserData(null);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUserData(null);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  if (!userData || !userId) return null;
  
  const accountFeatures = ACCOUNT_TIERS[userData.accountTier || 'free'];
  
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
      <Badge 
        variant="secondary"
        className={`${
          userData.accountTier === 'premium' 
            ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/20' 
            : 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-500 border-gray-500/20'
        }`}
      >
        {accountFeatures.badge || ''}
        {accountFeatures.displayName}
      </Badge>
    </div>
  );
}