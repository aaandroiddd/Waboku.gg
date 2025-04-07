import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

// Type for the cache entries
interface CacheEntry {
  hasAccount: boolean;
  timestamp: number;
}

// Create a cache for Stripe seller status to avoid repeated Firestore queries
// This is outside the hook to persist between renders and component instances
const stripeSellerCache: Record<string, CacheEntry> = {};

// Cache expiration time: 1 hour (in milliseconds)
const CACHE_EXPIRATION = 60 * 60 * 1000;

// Try to load cache from sessionStorage on initial load
if (typeof window !== 'undefined') {
  try {
    const savedCache = sessionStorage.getItem('stripeSellerCache');
    if (savedCache) {
      const parsedCache = JSON.parse(savedCache);
      Object.assign(stripeSellerCache, parsedCache);
    }
  } catch (error) {
    console.error('Error loading stripe seller cache from sessionStorage:', error);
  }
}

// Function to save cache to sessionStorage
const saveCache = () => {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('stripeSellerCache', JSON.stringify(stripeSellerCache));
    } catch (error) {
      console.error('Error saving stripe seller cache to sessionStorage:', error);
    }
  }
};

export function useStripeSellerStatus(userId: string) {
  const [hasStripeAccount, setHasStripeAccount] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Check if we have a valid cached result
    const cachedResult = stripeSellerCache[userId];
    const now = Date.now();
    
    if (cachedResult && (now - cachedResult.timestamp) < CACHE_EXPIRATION) {
      // Use cached result if it's still valid
      setHasStripeAccount(cachedResult.hasAccount);
      setIsLoading(false);
      return;
    }

    // If no valid cache, fetch from Firestore
    const { app } = getFirebaseServices();
    const firestore = getFirestore(app);
    const userDocRef = doc(firestore, 'users', userId);

    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      const data = doc.data();
      let hasAccount = false;
      
      if (data) {
        // Check if the user has a Stripe Connect account
        // First check the new structure
        if (data.stripeConnectStatus === 'active' && data.stripeConnectAccountId) {
          hasAccount = true;
        } 
        // Fallback to the old structure if needed
        else if (data.stripeConnectAccount?.accountId && data.stripeConnectAccount?.status === 'active') {
          hasAccount = true;
        }
      }
      
      // Update state
      setHasStripeAccount(hasAccount);
      setIsLoading(false);
      
      // Cache the result
      stripeSellerCache[userId] = {
        hasAccount,
        timestamp: Date.now()
      };
      
      // Save to sessionStorage
      saveCache();
    }, (error) => {
      console.error('Error fetching user Stripe data:', error);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return { hasStripeAccount, isLoading };
}