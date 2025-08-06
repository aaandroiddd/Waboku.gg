import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { isMfaEnabled } from '@/lib/mfa-utils';

interface EligibilityRequirement {
  id: string;
  label: string;
  description: string;
  met: boolean;
  loading: boolean;
}

interface SellerAccountEligibility {
  isEligible: boolean;
  requirements: EligibilityRequirement[];
  loading: boolean;
  error: string | null;
}

export function useSellerAccountEligibility(): SellerAccountEligibility {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<SellerAccountEligibility>({
    isEligible: false,
    requirements: [
      {
        id: 'email_verified',
        label: 'Email Verification',
        description: 'Your email address must be verified',
        met: false,
        loading: true,
      },
      {
        id: 'mfa_enabled',
        label: 'Two-Factor Authentication',
        description: 'Two-factor authentication must be enabled on your account',
        met: false,
        loading: true,
      },
      {
        id: 'account_age',
        label: 'Account Age',
        description: 'Your account must be at least 1 week old',
        met: false,
        loading: true,
      },
    ],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      setEligibility(prev => ({
        ...prev,
        loading: false,
        error: 'User not authenticated',
      }));
      return;
    }

    const checkEligibility = async () => {
      try {
        const requirements = [...eligibility.requirements];
        
        // Check email verification
        const emailVerified = user.emailVerified;
        requirements[0] = {
          ...requirements[0],
          met: emailVerified,
          loading: false,
        };

        // Check MFA status using Firebase Auth and Firestore
        let mfaEnabled = false;
        try {
          // First check if MFA is enabled in Firebase Auth
          mfaEnabled = isMfaEnabled(user);
          
          // If not enabled in Auth, check Firestore as fallback
          if (!mfaEnabled) {
            const { db } = await getFirebaseServices();
            if (db) {
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                mfaEnabled = userData.mfaEnabled === true;
              }
            }
          }
        } catch (error) {
          console.error('Error checking MFA status:', error);
        }
        
        requirements[1] = {
          ...requirements[1],
          met: mfaEnabled,
          loading: false,
        };

        // Check account age (1 week = 7 days)
        const accountCreationTime = user.metadata.creationTime;
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const accountAge = accountCreationTime ? new Date(accountCreationTime) : new Date();
        const accountOldEnough = accountAge <= oneWeekAgo;
        
        requirements[2] = {
          ...requirements[2],
          met: accountOldEnough,
          loading: false,
        };

        // Determine overall eligibility
        const allRequirementsMet = requirements.every(req => req.met);

        setEligibility({
          isEligible: allRequirementsMet,
          requirements,
          loading: false,
          error: null,
        });

      } catch (error) {
        console.error('Error checking seller account eligibility:', error);
        setEligibility(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to check eligibility requirements',
        }));
      }
    };

    checkEligibility();
  }, [user]);

  return eligibility;
}