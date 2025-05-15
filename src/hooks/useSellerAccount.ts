import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

export const useSellerAccount = () => {
  const { user } = useAuth();
  const [sellerStatus, setSellerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Define fetchSellerStatus before it's used
  const fetchSellerStatus = async (userId: string) => {
    try {
      const { db } = await getFirebaseServices();
      if (!db) {
        throw new Error('Firebase DB is not initialized');
      }
      
      const sellerDocRef = doc(db, 'sellerAccounts', userId);
      const sellerDoc = await getDoc(sellerDocRef);
      
      if (sellerDoc.exists()) {
        return sellerDoc.data();
      } else {
        return { status: 'not_registered' };
      }
    } catch (err) {
      console.error("Error in fetchSellerStatus:", err);
      throw err;
    }
  };

  useEffect(() => {
    const waitForUserFetch = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
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
  }, [user]);

  const refreshSellerStatus = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const status = await fetchSellerStatus(user.uid);
      setSellerStatus(status);
    } catch (err) {
      console.error("Error refreshing seller status:", err);
      setError("Failed to refresh seller account information");
    } finally {
      setLoading(false);
    }
  };

  return {
    sellerStatus,
    loading,
    error,
    refreshSellerStatus,
    // Also return the original account status interface for compatibility
    accountStatus: {
      isConnected: sellerStatus?.status === 'connected' || sellerStatus?.status === 'verified',
      isEnabled: sellerStatus?.status === 'verified',
      needsMoreInfo: sellerStatus?.status === 'pending' || sellerStatus?.status === 'connected'
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