import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

export const useSellerAccount = () => {
  const { user } = useAuth();
  const [sellerStatus, setSellerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create a shared fetchSellerStatus function using useCallback
  const fetchSellerStatus = useCallback(async (userId: string) => {
    try {
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firebase DB is not initialized');
      }
      
      // Fetch from users collection where Stripe Connect data is actually stored
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Check if user has Stripe Connect account
        if (userData.stripeConnectAccountId) {
          return {
            status: userData.stripeConnectStatus || 'pending',
            accountId: userData.stripeConnectAccountId,
            detailsSubmitted: userData.stripeConnectDetailsSubmitted || false,
            chargesEnabled: userData.stripeConnectChargesEnabled || false,
            payoutsEnabled: userData.stripeConnectPayoutsEnabled || false,
            createdAt: userData.stripeConnectCreatedAt,
            updatedAt: userData.stripeConnectUpdatedAt
          };
        } else {
          return { status: 'not_registered' };
        }
      } else {
        return { status: 'not_registered' };
      }
    } catch (err) {
      console.error("Error in fetchSellerStatus:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    const waitForUserFetch = async () => {
      if (!user) {
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setError(null); // Clear any previous errors
        const status = await fetchSellerStatus(user.uid);
        setSellerStatus(status);
      } catch (err) {
        console.error("Error fetching seller status:", err);
        setError("Failed to load seller account information");
      } finally {
        setLoading(false);
      }
    };

    waitForUserFetch();
  }, [user, fetchSellerStatus]);

  const refreshSellerStatus = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      // Use the API endpoint that checks with Stripe directly for the most up-to-date status
      const token = await user.getIdToken(true);
      const response = await fetch('/api/stripe/connect/account-status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch account status from API');
      }
      
      const apiStatus = await response.json();
      
      // Convert API response to our expected format
      const status = {
        status: apiStatus.status,
        accountId: apiStatus.accountId,
        detailsSubmitted: apiStatus.detailsSubmitted,
        chargesEnabled: apiStatus.chargesEnabled,
        payoutsEnabled: apiStatus.payoutsEnabled,
        hasListings: apiStatus.hasListings
      };
      
      setSellerStatus(status);
      console.log('Seller status refreshed from API:', status);
    } catch (err) {
      console.error("Error refreshing seller status from API:", err);
      // Fallback to local fetch if API fails
      try {
        const status = await fetchSellerStatus(user.uid);
        setSellerStatus(status);
      } catch (fallbackErr) {
        console.error("Error in fallback seller status fetch:", fallbackErr);
        setError("Failed to refresh seller account information");
      }
    } finally {
      setLoading(false);
    }
  }, [user, fetchSellerStatus]);

  return {
    sellerStatus,
    loading,
    error,
    refreshSellerStatus,
    // Also return the original account status interface for compatibility
    accountStatus: {
      isConnected: sellerStatus?.status === 'active' || sellerStatus?.accountId,
      isEnabled: sellerStatus?.status === 'active' && sellerStatus?.chargesEnabled && sellerStatus?.payoutsEnabled,
      needsMoreInfo: sellerStatus?.status === 'pending' || (sellerStatus?.accountId && sellerStatus?.status !== 'active')
    },
    isLoading: loading,
    createAccount: async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/stripe/connect/create-account', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to create account');
        }
        
        const data = await response.json();
        
        if (data.url) {
          window.open(data.url, '_blank');
        } else {
          throw new Error('No redirect URL provided');
        }
      } catch (err) {
        console.error('Error creating account:', err);
        throw err;
      }
    },
    updateAccount: async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/stripe/connect/update-account', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to update account');
        }
        
        const data = await response.json();
        
        if (data.url) {
          window.open(data.url, '_blank');
        } else {
          throw new Error('No redirect URL provided');
        }
      } catch (err) {
        console.error('Error updating account:', err);
        throw err;
      }
    },
    refreshStatus: async () => {
      await refreshSellerStatus();
    }
  };
};