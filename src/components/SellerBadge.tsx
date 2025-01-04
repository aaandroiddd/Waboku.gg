import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SellerBadgeProps {
  className?: string;
  userId?: string;
  showOnlyOnProfile?: boolean;
}

export function SellerBadge({ className, userId, showOnlyOnProfile = false }: SellerBadgeProps) {
  const { user } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkUserVerification = async () => {
      try {
        // If viewing own profile, use the current user's verification status
        if (user && (!userId || userId === user.uid)) {
          setIsVerified(user.emailVerified);
          return;
        }
        
        // If viewing another user's profile, check their verification status in Firestore
        if (userId) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsVerified(userData.emailVerified === true);
          } else {
            setIsVerified(false);
          }
        }
      } catch (error) {
        console.error('Error checking user verification:', error);
        setIsVerified(false);
      }
    };

    checkUserVerification();
  }, [userId, user]);

  // Don't show if not verified or if showOnlyOnProfile is true and we're not in a profile context
  if (!isVerified || (showOnlyOnProfile && !userId)) return null;
  
  return (
    <div 
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-green-500 bg-green-500/10 hover:bg-green-500/20 border-green-500/20 ${className || ""}`}
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
    </div>
  );
}