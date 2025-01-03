import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SellerBadgeProps {
  className?: string;
  userId?: string;
}

export function SellerBadge({ className, userId }: SellerBadgeProps) {
  const { user, isEmailVerified } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkUserVerification = async () => {
      if (userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            setIsVerified(userDoc.data().emailVerified === true);
          }
        } catch (error) {
          console.error('Error checking user verification:', error);
          setIsVerified(false);
        }
      } else if (user) {
        setIsVerified(isEmailVerified());
      }
    };

    checkUserVerification();
  }, [userId, user, isEmailVerified]);
  
  if (!user && !userId) return null;
  
  const verified = isVerified;
  
  if (verified) {
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
  
  return (
    <div 
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 ${className || ""}`}
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
        <path d="M15 9l-6 6" />
        <path d="M9 9l6 6" />
      </svg>
      Unverified
    </div>
  );
}