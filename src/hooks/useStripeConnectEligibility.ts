import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

export interface StripeConnectEligibility {
  isEligible: boolean;
  isLoading: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  reason?: string;
}

export function useStripeConnectEligibility(): StripeConnectEligibility {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<StripeConnectEligibility>({
    isEligible: false,
    isLoading: true
  });

  useEffect(() => {
    if (!user) {
      setEligibility({
        isEligible: false,
        isLoading: false
      });
      return;
    }

    const checkEligibility = async () => {
      try {
        setEligibility(prev => ({ ...prev, isLoading: true }));
        
        const { db } = await getFirebaseServices();
        if (!db) {
          throw new Error('Firebase DB is not initialized');
        }
        
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          setEligibility({
            isEligible: false,
            isLoading: false
          });
          return;
        }

        const userData = userDoc.data();
        
        // Check if user has been approved for Stripe Connect
        const isEligible = userData.stripeConnectEligible === true;
        const approvedBy = userData.stripeConnectApprovedBy;
        const approvedAt = userData.stripeConnectApprovedAt?.toDate();
        const reason = userData.stripeConnectApprovalReason;
        
        setEligibility({
          isEligible,
          isLoading: false,
          approvedBy,
          approvedAt,
          reason
        });
      } catch (error) {
        console.error('Error checking Stripe Connect eligibility:', error);
        setEligibility({
          isEligible: false,
          isLoading: false
        });
      }
    };

    checkEligibility();
  }, [user]);

  return eligibility;
}