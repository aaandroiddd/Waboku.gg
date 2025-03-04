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

      const [receivedOffersSnapshot, sentOffersSnapshot] = await Promise.all([
        getDocs(receivedOffersQuery),
        getDocs(sentOffersQuery)
      ]);

      const receivedOffersData = receivedOffersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Offer[];

      const sentOffersData = sentOffersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Offer[];

      setReceivedOffers(receivedOffersData);
      setSentOffers(sentOffersData);
    } catch (err: any) {
      console.error('Error fetching offers:', err);
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