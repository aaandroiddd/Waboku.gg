import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Offer } from '@/types/offer';
import { toast } from 'sonner';

export function useOffers() {
  const { user } = useAuth();
  const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
  const [sentOffers, setSentOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // First try to fetch using client-side Firebase
      try {
        const { db } = getFirebaseServices();
        
        // Fetch received offers (where user is the seller)
        const receivedOffersQuery = query(
          collection(db, 'offers'),
          where('sellerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        
        // Fetch sent offers (where user is the buyer)
        const sentOffersQuery = query(
          collection(db, 'offers'),
          where('buyerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        // Use try-catch for each query to handle potential errors separately
        let receivedOffersData: Offer[] = [];
        let sentOffersData: Offer[] = [];

        try {
          const receivedOffersSnapshot = await getDocs(receivedOffersQuery);
          receivedOffersData = receivedOffersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              // Ensure listingSnapshot has all required fields
              listingSnapshot: {
                title: data.listingSnapshot?.title || 'Unknown Listing',
                price: data.listingSnapshot?.price || 0,
                imageUrl: data.listingSnapshot?.imageUrl || '',
              }
            } as Offer;
          });
        } catch (receivedErr: any) {
          console.error('Error fetching received offers:', receivedErr);
          // Continue with the rest of the function, we'll still try to fetch sent offers
        }

        try {
          const sentOffersSnapshot = await getDocs(sentOffersQuery);
          sentOffersData = sentOffersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              // Ensure listingSnapshot has all required fields
              listingSnapshot: {
                title: data.listingSnapshot?.title || 'Unknown Listing',
                price: data.listingSnapshot?.price || 0,
                imageUrl: data.listingSnapshot?.imageUrl || '',
              }
            } as Offer;
          });
        } catch (sentErr: any) {
          console.error('Error fetching sent offers:', sentErr);
          // Continue with the function, we'll still set whatever data we have
        }

        // If we have data from both queries, use it
        if (receivedOffersData.length > 0 || sentOffersData.length > 0) {
          setReceivedOffers(receivedOffersData);
          setSentOffers(sentOffersData);
          return; // Exit early if we have data
        }
      } catch (clientErr) {
        console.error('Error in client-side Firebase fetch:', clientErr);
        // Fall through to API fetch
      }
      
      // If client-side fetch failed or returned no data, try the API endpoint
      console.log('Falling back to API endpoint for offers');
      const token = await user.getIdToken();
      const response = await fetch('/api/offers/get-offers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch offers from API');
      }
      
      const data = await response.json();
      setReceivedOffers(data.receivedOffers);
      setSentOffers(data.sentOffers);
      
    } catch (err: any) {
      console.error('Error in fetchOffers main function:', err);
      setError('Failed to load offers. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const updateOfferStatus = async (offerId: string, status: 'accepted' | 'declined' | 'expired' | 'countered') => {
    if (!user) return;

    try {
      const { db } = getFirebaseServices();
      const offerRef = doc(db, 'offers', offerId);
      
      await updateDoc(offerRef, {
        status,
        updatedAt: serverTimestamp()
      });

      // Update local state for both received and sent offers
      setReceivedOffers(prev => 
        prev.map(offer => 
          offer.id === offerId ? { ...offer, status, updatedAt: new Date() } : offer
        )
      );
      
      setSentOffers(prev => 
        prev.map(offer => 
          offer.id === offerId ? { ...offer, status, updatedAt: new Date() } : offer
        )
      );

      toast.success(`Offer ${status} successfully`);
      return true;
    } catch (err: any) {
      console.error(`Error ${status} offer:`, err);
      toast.error(`Failed to ${status} offer. Please try again.`);
      return false;
    }
  };
  
  const makeCounterOffer = async (offerId: string, counterAmount: number) => {
    if (!user) return;
    
    try {
      const { db } = getFirebaseServices();
      const offerRef = doc(db, 'offers', offerId);
      
      // Get the current offer to verify the user is the seller
      const offerSnap = await getDoc(offerRef);
      if (!offerSnap.exists()) {
        throw new Error('Offer not found');
      }
      
      const offerData = offerSnap.data();
      if (offerData.sellerId !== user.uid) {
        throw new Error('You are not authorized to make a counter offer');
      }
      
      // Update the offer with counter offer amount and change status
      await updateDoc(offerRef, {
        counterOffer: counterAmount,
        status: 'countered',
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setReceivedOffers(prev => 
        prev.map(offer => 
          offer.id === offerId ? { 
            ...offer, 
            counterOffer: counterAmount, 
            status: 'countered', 
            updatedAt: new Date() 
          } : offer
        )
      );
      
      return true;
    } catch (err: any) {
      console.error('Error making counter offer:', err);
      toast.error(err.message || 'Failed to make counter offer');
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchOffers();
    } else {
      setReceivedOffers([]);
      setSentOffers([]);
      setLoading(false);
    }
  }, [user]);

  return {
    receivedOffers,
    sentOffers,
    loading,
    error,
    fetchOffers,
    updateOfferStatus,
    makeCounterOffer
  };
}