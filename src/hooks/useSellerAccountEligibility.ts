import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
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
        
        // First check if user has any active listings based on user metadata
        let hasListings = userData?.listingCount > 0 || userData?.hasActiveListings === true;
        
        // If no listings found in user metadata, directly check the listings collection
        if (!hasListings) {
          // Query the listings collection for any listings by this user
          const listingsQuery = query(
            collection(firestore, 'listings'),
            where('userId', '==', user.uid),
            limit(1)
          );
          
          const listingsSnapshot = await getDocs(listingsQuery);
          hasListings = !listingsSnapshot.empty;
          
          // If we found listings but the user metadata doesn't reflect it,
          // update the user metadata for future checks
          if (hasListings && userData && !userData.hasActiveListings) {
            try {
              await doc(firestore, 'users', user.uid).update({
                hasActiveListings: true,
                listingCount: listingsSnapshot.size
              });
              console.log('Updated user metadata with listing information');
            } catch (updateError) {
              console.error('Error updating user listing metadata:', updateError);
            }
          }
        }
        
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