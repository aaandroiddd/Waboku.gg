import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp, getDoc, addDoc, setDoc } from 'firebase/firestore';
import { Offer } from '@/types/offer';
import { Order } from '@/types/order';
import { toast } from 'sonner';

export function useOffers() {
  const { user } = useAuth();
  const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
  const [sentOffers, setSentOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // First try to fetch using client-side Firebase
      try {
        console.log('Attempting to fetch offers using client-side Firebase...');
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
          console.log('Fetching received offers...');
          const receivedOffersSnapshot = await getDocs(receivedOffersQuery);
          receivedOffersData = receivedOffersSnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                expiresAt: data.expiresAt?.toDate() || null,
                // Ensure listingSnapshot has all required fields
                listingSnapshot: {
                  title: data.listingSnapshot?.title || 'Unknown Listing',
                  price: data.listingSnapshot?.price || 0,
                  imageUrl: data.listingSnapshot?.imageUrl || '',
                },
                // Ensure cleared property is properly typed
                cleared: data.cleared === true
              } as Offer;
            })
            // Filter out cleared offers
            .filter(offer => !offer.cleared);
          console.log(`Found ${receivedOffersData.length} received offers (excluding cleared)`);
        } catch (receivedErr: any) {
          console.error('Error fetching received offers:', receivedErr);
          // Continue with the rest of the function, we'll still try to fetch sent offers
        }

        try {
          console.log('Fetching sent offers...');
          const sentOffersSnapshot = await getDocs(sentOffersQuery);
          sentOffersData = sentOffersSnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
                expiresAt: data.expiresAt?.toDate() || null,
                // Ensure listingSnapshot has all required fields
                listingSnapshot: {
                  title: data.listingSnapshot?.title || 'Unknown Listing',
                  price: data.listingSnapshot?.price || 0,
                  imageUrl: data.listingSnapshot?.imageUrl || '',
                },
                // Ensure cleared property is properly typed
                cleared: data.cleared === true
              } as Offer;
            })
            // Filter out cleared offers
            .filter(offer => !offer.cleared);
          console.log(`Found ${sentOffersData.length} sent offers (excluding cleared)`);
        } catch (sentErr: any) {
          console.error('Error fetching sent offers:', sentErr);
          // Continue with the function, we'll still set whatever data we have
        }

        // Always use client-side data if we successfully fetched it (even if empty)
        console.log('Using client-side fetched data');
        setReceivedOffers(receivedOffersData);
        setSentOffers(sentOffersData);
        return; // Exit early since client-side fetch was successful
      } catch (clientErr: any) {
        console.error('Error in client-side Firebase fetch:', clientErr);
        console.log('Falling back to API endpoint due to client-side error');
        // Fall through to API fetch
      }
      
      // If client-side fetch failed or returned no data, try the API endpoint
      console.log('Fetching offers via API endpoint...');
      try {
        const token = await user.getIdToken();
        console.log('Got auth token, making API request...');
        
        const response = await fetch('/api/offers/get-offers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          let errorData;
          try {
            const errorText = await response.text();
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: 'Invalid JSON response', message: errorText };
            }
          } catch (e) {
            errorData = { error: 'Could not read error response', message: 'Unknown error' };
          }
          
          console.error('API error response:', {
            status: response.status,
            statusText: response.statusText,
            data: errorData
          });
          
          throw new Error(errorData?.message || `API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`API returned ${data.receivedOffers?.length || 0} received offers and ${data.sentOffers?.length || 0} sent offers`);
        
        setReceivedOffers(data.receivedOffers || []);
        setSentOffers(data.sentOffers || []);
      } catch (apiErr: any) {
        console.error('Error fetching from API endpoint:', apiErr);
        throw apiErr; // Re-throw to be caught by the outer catch block
      }
    } catch (err: any) {
      console.error('Error in fetchOffers main function:', err);
      setError(`Failed to load offers: ${err.message || 'Unknown error'}`);
      toast.error('Could not load your offers. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateOfferStatus = async (offerId: string, status: 'accepted' | 'declined' | 'expired' | 'countered') => {
    if (!user) return false;

    try {
      const { db } = getFirebaseServices();
      const offerRef = doc(db, 'offers', offerId);
      
      // Update the offer status in Firestore
      await updateDoc(offerRef, {
        status,
        updatedAt: serverTimestamp()
      });

      // Immediately update local state to reflect the change
      const updateOfferInState = (offers: Offer[]) => 
        offers.map(offer => 
          offer.id === offerId 
            ? { ...offer, status, updatedAt: new Date() }
            : offer
        );

      setReceivedOffers(prev => updateOfferInState(prev));
      setSentOffers(prev => updateOfferInState(prev));

      // Show appropriate toast message based on status
      if (status === 'accepted') {
        toast.success('Offer accepted', {
          description: 'The offer has been accepted successfully'
        });
      } else if (status === 'declined') {
        toast.success('Offer declined', {
          description: 'The offer has been declined'
        });
      } else if (status === 'countered') {
        toast.success('Counter offer sent', {
          description: 'Your counter offer has been sent to the buyer'
        });
      } else if (status === 'expired') {
        toast.info('Offer marked as expired');
      }

      // Refresh offers data in the background to ensure consistency for all status changes
      setTimeout(() => {
        console.log(`Refreshing offers after ${status} status update for offer ${offerId}`);
        fetchOffers();
      }, 1000);
      
      return true;
    } catch (err: any) {
      console.error(`Error ${status} offer:`, err);
      toast.error(`Failed to ${status} offer. Please try again.`);
      return false;
    }
  };
  
  const makeCounterOffer = async (offerId: string, counterAmount: number) => {
    if (!user) return false;
    
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

      // Immediately update local state to reflect the change
      const updateOfferInState = (offers: Offer[]) => 
        offers.map(offer => 
          offer.id === offerId 
            ? { ...offer, counterOffer: counterAmount, status: 'countered', updatedAt: new Date() }
            : offer
        );

      setReceivedOffers(prev => updateOfferInState(prev));
      setSentOffers(prev => updateOfferInState(prev));
      
      toast.success('Counter offer sent', {
        description: 'Your counter offer has been sent to the buyer'
      });

      // Refresh offers data in the background to ensure consistency
      setTimeout(() => {
        console.log(`Refreshing offers after counter offer for offer ${offerId}`);
        fetchOffers();
      }, 1000);
      
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
  }, [user, fetchOffers]);

  const cancelOffer = async (offerId: string) => {
    if (!user) return false;
    
    try {
      const { db } = getFirebaseServices();
      const offerRef = doc(db, 'offers', offerId);
      
      // Get the current offer to verify the user is the buyer
      const offerSnap = await getDoc(offerRef);
      if (!offerSnap.exists()) {
        throw new Error('Offer not found');
      }
      
      const offerData = offerSnap.data();
      if (offerData.buyerId !== user.uid) {
        throw new Error('You are not authorized to cancel this offer');
      }
      
      // Update the offer status to cancelled
      await updateDoc(offerRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });

      // Immediately update local state to reflect the change
      const updateOfferInState = (offers: Offer[]) => 
        offers.map(offer => 
          offer.id === offerId 
            ? { ...offer, status: 'cancelled', updatedAt: new Date() }
            : offer
        );

      setReceivedOffers(prev => updateOfferInState(prev));
      setSentOffers(prev => updateOfferInState(prev));
      
      // Show success toast
      toast.success('Offer cancelled successfully', {
        description: 'The offer has been cancelled'
      });

      // Refresh offers data in the background to ensure consistency
      setTimeout(() => {
        fetchOffers();
      }, 1000);
      
      return true;
    } catch (err: any) {
      console.error('Error cancelling offer:', err);
      toast.error(err.message || 'Failed to cancel offer');
      return false;
    }
  };

  const clearOffer = async (offerId: string) => {
    if (!user) return false;
    
    try {
      const { db } = getFirebaseServices();
      const offerRef = doc(db, 'offers', offerId);
      
      // Get the current offer to verify the user is involved
      const offerSnap = await getDoc(offerRef);
      if (!offerSnap.exists()) {
        throw new Error('Offer not found');
      }
      
      const offerData = offerSnap.data();
      if (offerData.buyerId !== user.uid && offerData.sellerId !== user.uid) {
        throw new Error('You are not authorized to clear this offer');
      }
      
      // Update the offer with cleared flag
      await updateDoc(offerRef, {
        cleared: true,
        updatedAt: serverTimestamp()
      });

      // Immediately remove the offer from local state
      setReceivedOffers(prev => prev.filter(offer => offer.id !== offerId));
      setSentOffers(prev => prev.filter(offer => offer.id !== offerId));
      
      // Show success toast
      toast.success('Offer cleared successfully', {
        description: 'The offer has been removed from your dashboard'
      });

      // Refresh offers data in the background to ensure consistency
      setTimeout(() => {
        fetchOffers();
      }, 1000);
      
      return true;
    } catch (err: any) {
      console.error('Error clearing offer:', err);
      toast.error(err.message || 'Failed to clear offer');
      return false;
    }
  };

  const createOrderFromOffer = async (offerId: string, markAsSold: boolean = false) => {
    if (!user) {
      console.error('Cannot create order: User not authenticated');
      toast.error('You must be logged in to create an order');
      return false;
    }
    
    try {
      console.log(`Creating order from offer ${offerId}, markAsSold=${markAsSold}`);
      
      // First try client-side Firebase
      try {
        const { db } = getFirebaseServices();
        if (!db) {
          throw new Error('Firebase database not initialized');
        }
        
        console.log('Getting offer reference...');
        const offerRef = doc(db, 'offers', offerId);
        
        // Get the current offer
        console.log('Fetching offer data...');
        const offerSnap = await getDoc(offerRef);
        if (!offerSnap.exists()) {
          throw new Error('Offer not found');
        }
        
        const offerData = offerSnap.data();
        console.log('Offer data retrieved:', { 
          offerId, 
          sellerId: offerData.sellerId,
          buyerId: offerData.buyerId,
          status: offerData.status
        });
        
        // Verify the user is the seller
        if (offerData.sellerId !== user.uid) {
          throw new Error('Only the seller can create an order from an offer');
        }
        
        // Verify the offer is accepted
        if (offerData.status !== 'accepted') {
          throw new Error('Only accepted offers can be converted to orders');
        }
        
        // Create a placeholder shipping address (this would normally come from the buyer)
        const placeholderAddress = {
          name: 'To be provided by buyer',
          line1: 'Address pending',
          city: 'TBD',
          state: 'TBD',
          postal_code: 'TBD',
          country: 'TBD'
        };
        
        // Create the order
        const orderData = {
          listingId: offerData.listingId,
          buyerId: offerData.buyerId,
          sellerId: offerData.sellerId,
          amount: offerData.amount,
          status: 'pending',
          shippingAddress: placeholderAddress,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          listingSnapshot: offerData.listingSnapshot || {
            title: 'Unknown Listing',
            price: offerData.amount || 0,
            imageUrl: ''
          },
          offerId: offerId // Reference to the original offer
        };
        
        console.log('Creating order document...');
        try {
          // Get a fresh auth token before creating the order
          const token = await user.getIdToken(true);
          console.log('Got fresh auth token, length:', token.length);
          
          // Create the order document
          const ordersCollection = collection(db, 'orders');
          const orderDocRef = await addDoc(ordersCollection, orderData);
          const orderId = orderDocRef.id;
          console.log('Order created successfully with ID:', orderId);
          
          // Create references in user-specific subcollections for both buyer and seller
          console.log('Creating user-specific order references...');
          
          // Create buyer's order reference
          const buyerOrderRef = doc(db, 'users', offerData.buyerId, 'orders', orderId);
          await setDoc(buyerOrderRef, {
            orderId: orderId,
            role: 'buyer',
            createdAt: serverTimestamp()
          });
          console.log(`Created buyer's order reference for user ${offerData.buyerId}`);
          
          // Create seller's order reference
          const sellerOrderRef = doc(db, 'users', offerData.sellerId, 'orders', orderId);
          await setDoc(sellerOrderRef, {
            orderId: orderId,
            role: 'seller',
            createdAt: serverTimestamp()
          });
          console.log(`Created seller's order reference for user ${offerData.sellerId}`);
          
          // Mark the offer as cleared
          console.log('Marking offer as cleared...');
          await updateDoc(offerRef, {
            cleared: true,
            updatedAt: serverTimestamp()
          });

          // Immediately remove the offer from local state
          setReceivedOffers(prev => prev.filter(offer => offer.id !== offerId));
          setSentOffers(prev => prev.filter(offer => offer.id !== offerId));
          
          // If markAsSold is true, update the listing status to sold
          if (markAsSold) {
            console.log('Marking listing as sold...');
            const listingRef = doc(db, 'listings', offerData.listingId);
            await updateDoc(listingRef, {
              status: 'sold',
              soldTo: offerData.buyerId,
              updatedAt: serverTimestamp()
            });
          }
          
          console.log('Order creation process completed successfully');
          
          // Refresh offers data in the background to ensure consistency
          setTimeout(() => {
            fetchOffers();
          }, 1000);
          
          return true;
        } catch (writeError: any) {
          console.error('Error writing to Firestore:', writeError);
          
          // Check if this is an authentication error
          if (writeError.code === 'permission-denied' || 
              writeError.message?.includes('permission') || 
              writeError.message?.includes('unauthorized')) {
            console.log('Permission denied error detected, will try server-side API as fallback');
            throw new Error('Authentication error: ' + writeError.message);
          }
          
          throw writeError;
        }
      } catch (clientError: any) {
        console.error('Client-side order creation failed:', clientError);
        console.log('Attempting to create order via server API...');
        
        // Try server-side API as fallback
        try {
          const token = await user.getIdToken(true);
          const response = await fetch('/api/offers/create-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              offerId,
              markAsSold
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API error: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('Order created via API:', data);

          // Immediately remove the offer from local state
          setReceivedOffers(prev => prev.filter(offer => offer.id !== offerId));
          setSentOffers(prev => prev.filter(offer => offer.id !== offerId));
          
          // Refresh offers data in the background to ensure consistency
          setTimeout(() => {
            fetchOffers();
          }, 1000);
          
          return true;
        } catch (apiError: any) {
          console.error('API order creation failed:', apiError);
          throw apiError;
        }
      }
    } catch (err: any) {
      console.error('Error creating order from offer:', err);
      toast.error(err.message || 'Failed to create order from offer');
      return false;
    }
  };
  
  const markListingAsSold = async (listingId: string, buyerId: string) => {
    if (!user) return false;
    
    try {
      const { db } = getFirebaseServices();
      const listingRef = doc(db, 'listings', listingId);
      
      // Update the listing status to sold
      await updateDoc(listingRef, {
        status: 'sold',
        soldTo: buyerId,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (err: any) {
      console.error('Error marking listing as sold:', err);
      toast.error(err.message || 'Failed to mark listing as sold');
      return false;
    }
  };

  return {
    receivedOffers,
    sentOffers,
    loading,
    error,
    fetchOffers,
    updateOfferStatus,
    makeCounterOffer,
    cancelOffer,
    clearOffer,
    createOrderFromOffer,
    markListingAsSold
  };
}