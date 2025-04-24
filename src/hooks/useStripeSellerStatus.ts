import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

// Cache for seller status to avoid redundant queries
interface SellerStatusCache {
  [userId: string]: {
    hasStripeAccount: boolean;
    timestamp: number;
  };
}

// In-memory cache
const sellerStatusCache: SellerStatusCache = {};

// Cache expiration time (15 minutes)
const CACHE_EXPIRY = 15 * 60 * 1000;

export function useStripeSellerStatus(userId: string) {
  const [hasStripeAccount, setHasStripeAccount] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const checkSellerStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Check cache first
        const cachedStatus = sellerStatusCache[userId];
        const now = Date.now();
        
        if (cachedStatus && (now - cachedStatus.timestamp < CACHE_EXPIRY)) {
          // Use cached data if it's still valid
          if (isMounted) {
            setHasStripeAccount(cachedStatus.hasStripeAccount);
            setIsLoading(false);
          }
          return;
        }
        
        // If not in cache or expired, fetch from Firestore
        const { db } = await getFirebaseServices();
        if (!db) {
          throw new Error('Firebase DB is not initialized');
        }
        
        // Check user document for Stripe account info
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const hasAccount = Boolean(
            userData.stripeConnectAccountId || 
            userData.stripeAccountVerified || 
            userData.stripeAccountStatus === 'verified'
          );
          
          // Update cache
          sellerStatusCache[userId] = {
            hasStripeAccount: hasAccount,
            timestamp: now
          };
          
          if (isMounted) {
            setHasStripeAccount(hasAccount);
          }
        } else {
          // User document doesn't exist
          sellerStatusCache[userId] = {
            hasStripeAccount: false,
            timestamp: now
          };
          
          if (isMounted) {
            setHasStripeAccount(false);
          }
        }
      } catch (err) {
        console.error('Error checking seller status:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          // Default to false on error
          setHasStripeAccount(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    checkSellerStatus();
    
    return () => {
      isMounted = false;
    };
  }, [userId]);
  
  return { hasStripeAccount, isLoading, error };
}