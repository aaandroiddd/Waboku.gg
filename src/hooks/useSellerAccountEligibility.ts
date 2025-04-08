import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

export function useSellerAccountEligibility() {
  const { user } = useAuth();
  const [isEligible, setIsEligible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasActiveListings, setHasActiveListings] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setIsEligible(false);
      return;
    }

    const checkEligibility = async () => {
      try {
        setIsLoading(true);
        const { app } = getFirebaseServices();
        const firestore = getFirestore(app);
        
        // Check if user has the seller role or has explicitly opted in
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        
        // Check if user has any active listings
        const hasListings = userData?.listingCount > 0 || userData?.hasActiveListings === true;
        setHasActiveListings(hasListings);
        
        // User is eligible if they have the seller role, have opted in, or have active listings
        const eligible = 
          userData?.roles?.includes('seller') === true || 
          userData?.sellerAccountEnabled === true ||
          hasListings;
        
        setIsEligible(eligible);
      } catch (error) {
        console.error('Error checking seller eligibility:', error);
        // Default to not eligible if there's an error
        setIsEligible(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkEligibility();
  }, [user]);

  return { isEligible, isLoading, hasActiveListings };
}