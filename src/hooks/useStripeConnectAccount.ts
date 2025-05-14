import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Type for the Stripe Connect account status
export type StripeConnectStatus = 'none' | 'pending' | 'active' | 'error';

// Type for the Stripe Connect account data
interface StripeConnectAccountData {
  status: StripeConnectStatus;
  accountId?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  hasListings?: boolean;
  errorMessage?: string;
}

// Type for the cache entries
interface CacheEntry {
  data: StripeConnectAccountData;
  timestamp: number;
}

// Create a cache for Stripe connect account status to avoid repeated API calls
// This is outside the hook to persist between renders and component instances
const stripeConnectCache: Record<string, CacheEntry> = {};

// Cache expiration time: 5 minutes (in milliseconds)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Try to load cache from localStorage on initial load
if (typeof window !== 'undefined') {
  try {
    const savedCache = localStorage.getItem('stripeConnectCache');
    if (savedCache) {
      const parsedCache = JSON.parse(savedCache);
      Object.assign(stripeConnectCache, parsedCache);
    }
  } catch (error) {
    console.error('Error loading stripe connect cache from localStorage:', error);
  }
}

// Function to save cache to localStorage
const saveCache = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('stripeConnectCache', JSON.stringify(stripeConnectCache));
    } catch (error) {
      console.error('Error saving stripe connect cache to localStorage:', error);
    }
  }
};

export function useStripeConnectAccount(forceRefresh = false) {
  const { user } = useAuth();
  const [accountData, setAccountData] = useState<StripeConnectAccountData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setAccountData(null);
      return;
    }

    const fetchAccountStatus = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check if we have a valid cached result and we're not forcing a refresh
        const cachedResult = stripeConnectCache[user.uid];
        const now = Date.now();
        
        if (!forceRefresh && cachedResult && (now - cachedResult.timestamp) < CACHE_EXPIRATION) {
          // Use cached result if it's still valid
          setAccountData(cachedResult.data);
          setIsLoading(false);
          return;
        }

        // Get the auth token
        const token = await user.getIdToken(true);
        
        const response = await fetch('/api/stripe/connect/account-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check account status');
        }

        const data = await response.json();
        
        const accountData: StripeConnectAccountData = {
          status: data.status,
          accountId: data.accountId,
          detailsSubmitted: data.detailsSubmitted,
          chargesEnabled: data.chargesEnabled,
          payoutsEnabled: data.payoutsEnabled,
          hasListings: data.hasListings
        };
        
        // Update state
        setAccountData(accountData);
        
        // Cache the result
        stripeConnectCache[user.uid] = {
          data: accountData,
          timestamp: Date.now()
        };
        
        // Save to localStorage
        saveCache();
      } catch (err: any) {
        console.error('Error fetching Stripe Connect account status:', err);
        setError(err.message || 'Failed to check account status');
        
        // Set error status in account data
        const errorData: StripeConnectAccountData = {
          status: 'error',
          errorMessage: err.message || 'Failed to check account status'
        };
        
        setAccountData(errorData);
        
        // Cache the error result (but with a shorter expiration)
        stripeConnectCache[user.uid] = {
          data: errorData,
          // Error cache expires sooner (1 minute)
          timestamp: Date.now() - (CACHE_EXPIRATION - 60000)
        };
        
        // Save to localStorage
        saveCache();
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccountStatus();
  }, [user, forceRefresh]);

  // Function to manually refresh the account status
  const refreshAccountStatus = async () => {
    if (user) {
      // Clear the cache for this user
      if (stripeConnectCache[user.uid]) {
        delete stripeConnectCache[user.uid];
        saveCache();
      }
      
      try {
        // Force a refresh by setting forceRefresh to true
        setIsLoading(true);
        setError(null);

        // Get the auth token
        const token = await user.getIdToken(true);
        
        const response = await fetch('/api/stripe/connect/account-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check account status');
        }

        const data = await response.json();
        
        const accountData: StripeConnectAccountData = {
          status: data.status,
          accountId: data.accountId,
          detailsSubmitted: data.detailsSubmitted,
          chargesEnabled: data.chargesEnabled,
          payoutsEnabled: data.payoutsEnabled,
          hasListings: data.hasListings
        };
        
        // Update state
        setAccountData(accountData);
        
        // Cache the result
        stripeConnectCache[user.uid] = {
          data: accountData,
          timestamp: Date.now()
        };
        
        // Save to localStorage
        saveCache();
      } catch (err: any) {
        console.error('Error refreshing Stripe Connect account status:', err);
        setError(err.message || 'Failed to check account status');
        
        // Set error status in account data
        const errorData: StripeConnectAccountData = {
          status: 'error',
          errorMessage: err.message || 'Failed to check account status'
        };
        
        setAccountData(errorData);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return { 
    accountData, 
    isLoading, 
    error, 
    refreshAccountStatus 
  };
}