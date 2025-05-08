import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures, SubscriptionDetails } from '@/types/account';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { getFirebaseServices, registerListener, removeListener } from '@/lib/firebase';

interface AccountContextType {
  accountTier: AccountTier;
  features: AccountFeatures;
  isLoading: boolean;
  subscription: SubscriptionDetails;
  upgradeToPremium: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
}

const defaultSubscription: SubscriptionDetails = {
  status: 'none',
  stripeSubscriptionId: undefined,
  startDate: undefined,
  endDate: undefined,
  renewalDate: undefined
};

const defaultContext: AccountContextType = {
  accountTier: 'free',
  features: ACCOUNT_TIERS['free'],
  isLoading: true,
  subscription: defaultSubscription,
  upgradeToPremium: async () => {
    throw new Error('Context not initialized');
  },
  cancelSubscription: async () => {
    throw new Error('Context not initialized');
  },
  refreshAccountData: async () => {
    throw new Error('Context not initialized');
  }
};

const AccountContext = createContext<AccountContextType>(defaultContext);

// Unique ID for the Firestore listener
const ACCOUNT_LISTENER_ID = 'account-subscription-listener';

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accountTier, setAccountTier] = useState<AccountTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails>(defaultSubscription);

  // Track active listeners to ensure proper cleanup
  const firestoreListenerRef = useRef<(() => void) | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const lastCheckTimeRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  
  useEffect(() => {
    let isMounted = true;

    const checkSubscriptionStatus = async () => {
      if (!user) return null;
      
      // Prevent checking too frequently (at most once every 5 minutes)
      const now = Date.now();
      if (now - lastCheckTimeRef.current < 5 * 60 * 1000) {
        console.log('Skipping subscription check - checked recently');
        return null;
      }
      
      try {
        lastCheckTimeRef.current = now;
        const idToken = await user.getIdToken();
        
        // Add timeout and retry logic for better network resilience
        let attempts = 0;
        const maxAttempts = 2; // Reduced from 3 to 2 to fail faster
        
        while (attempts < maxAttempts) {
          try {
            console.log(`Attempting to check subscription status (attempt ${attempts + 1}/${maxAttempts})...`);
            
            // Use AbortController to implement timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced from 10s to 5s
            
            const response = await fetch('/api/stripe/check-subscription', {
              headers: {
                'Authorization': `Bearer ${idToken}`
              },
              signal: controller.signal
            });
            
            // Clear the timeout
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
              console.warn(`Subscription check failed with status ${response.status}:`, errorData);
              
              // For 401 errors, we might need a new token
              if (response.status === 401) {
                // Try to get a fresh token for the next attempt
                if (attempts < maxAttempts - 1) {
                  console.log('Auth error detected, refreshing token for next attempt');
                  await user.getIdToken(true);
                }
              }
              
              // If we get a 401, don't block the app functionality - return a default response
              if (response.status === 401) {
                console.log('Returning default subscription data due to auth error');
                return {
                  isPremium: false,
                  status: 'none',
                  tier: 'free',
                  error: 'auth'
                };
              }
              
              throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Subscription check successful:', {
              isPremium: data.isPremium,
              status: data.status,
              tier: data.tier
            });
            
            return data;
          } catch (fetchError: any) {
            attempts++;
            
            // If this is our last attempt, don't block the app - return a default response
            if (attempts >= maxAttempts) {
              console.error('Max subscription check attempts reached, using default subscription data');
              return {
                isPremium: false,
                status: 'none',
                tier: 'free',
                error: 'network'
              };
            }
            
            // For network errors, wait before retrying
            const isNetworkError = fetchError.name === 'AbortError' || 
                                  fetchError.message.includes('network') ||
                                  fetchError.message.includes('fetch');
            
            if (isNetworkError) {
              const delay = Math.min(1000 * Math.pow(2, attempts), 3000); // Reduced max delay
              console.log(`Network error, waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // This should never be reached due to the return in the loop
        return {
          isPremium: false,
          status: 'none',
          tier: 'free',
          error: 'unknown'
        };
      } catch (error) {
        console.error('Error checking subscription status:', error);
        // Return a default object instead of null to prevent UI errors
        return {
          isPremium: false,
          status: 'error',
          tier: 'free',
          error: true
        };
      }
    };

    // Clean up any existing listener
    const cleanupListener = () => {
      if (firestoreListenerRef.current) {
        console.log('[AccountContext] Cleaning up previous Firestore listener');
        firestoreListenerRef.current();
        firestoreListenerRef.current = null;
      }
      
      // Also try to remove using the registered listener system
      removeListener(ACCOUNT_LISTENER_ID);
    };

    const initializeAccount = async () => {
      // Clean up any existing listener first
      cleanupListener();
      
      if (!user) {
        if (isMounted) {
          setAccountTier('free');
          setSubscription(defaultSubscription);
          setIsLoading(false);
        }
        return;
      }

      try {
        const { app, db } = getFirebaseServices();
        if (!db) {
          console.error('[AccountContext] Firestore not initialized');
          setIsLoading(false);
          return;
        }
        
        const userDocRef = doc(db, 'users', user.uid);

        // Initialize account for new users
        try {
          const docSnapshot = await getDoc(userDocRef);
          if (!docSnapshot.exists()) {
            // Set default values for new users
            await setDoc(userDocRef, {
              accountTier: 'free',
              subscription: {
                status: 'none',
                startDate: new Date().toISOString()
              },
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        } catch (error) {
          console.error('[AccountContext] Error checking/initializing user document:', error);
        }

        // Set up listener for Firestore document changes using the centralized listener system
        console.log('[AccountContext] Setting up Firestore listener for account data');
        
        const unsubscribe = registerListener(
          ACCOUNT_LISTENER_ID,
          userDocRef,
          async (docSnapshot) => {
            if (!isMounted) return;
            
            try {
              const data = docSnapshot.data();
              if (data) {
                // Check subscription status
                const subscriptionStatus = await checkSubscriptionStatus();
                
                // Get subscription data
                const subscriptionData = subscriptionStatus || data.subscription || defaultSubscription;
                
                // Determine account status based on subscription
                const now = new Date();
                const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
                const startDate = subscriptionData.startDate ? new Date(subscriptionData.startDate) : null;
                
                // Enhanced premium status check with better logging
                const isActivePremium = (
                  // Stripe subscription checks
                  subscriptionData.status === 'active' ||
                  (subscriptionData.status === 'canceled' && endDate && endDate > now) ||
                  (subscriptionData.stripeSubscriptionId && startDate && startDate <= now && !subscriptionData.status) ||
                  
                  // Regular subscription checks
                  (subscriptionData.stripeSubscriptionId?.startsWith('sub_') && !subscriptionData.stripeSubscriptionId?.includes('admin_')) ||
                  
                  // Admin-set premium status checks
                  (data.accountTier === 'premium' && subscriptionData.manuallyUpdated) ||
                  (subscriptionData.currentPlan === 'premium') || // Check for currentPlan set by admin
                  (subscriptionData.stripeSubscriptionId?.includes('admin_')) || // Check for admin-assigned subscription ID
                  
                  // Direct Firestore premium tier check
                  (data.accountTier === 'premium' && data.subscription?.manuallyUpdated === true)
                );
                
                console.log('[AccountContext] Account tier determination:', {
                  uid: user.uid,
                  email: user.email,
                  currentTier: data.accountTier,
                  calculatedTier: isActivePremium ? 'premium' : 'free',
                  subscriptionStatus: subscriptionData.status,
                  hasStripeId: !!subscriptionData.stripeSubscriptionId,
                  isManuallyUpdated: !!subscriptionData.manuallyUpdated,
                  currentPlan: subscriptionData.currentPlan
                });
                
                // Set subscription data with enhanced validation
                const currentStatus = (() => {
                  if (subscriptionData.status === 'active') return 'active';
                  if (subscriptionData.status === 'canceled' && endDate && endDate > now) return 'canceled';
                  if (subscriptionData.stripeSubscriptionId && !subscriptionData.status) return 'active';
                  return 'none';
                })();

                // For admin-assigned subscriptions, ensure we have a renewal date
                let renewalDate = subscriptionData.renewalDate;
                if (subscriptionData.stripeSubscriptionId?.includes('admin_') && !renewalDate) {
                  const endDate = new Date();
                  endDate.setFullYear(endDate.getFullYear() + 1); // Set end date to 1 year from now
                  renewalDate = endDate.toISOString();
                }

                const subscriptionDetails = {
                  startDate: subscriptionData.startDate,
                  endDate: subscriptionData.endDate,
                  renewalDate: renewalDate,
                  status: currentStatus,
                  stripeSubscriptionId: subscriptionData.stripeSubscriptionId
                };
                
                setSubscription(subscriptionDetails);
                setAccountTier(isActivePremium ? 'premium' : 'free');

                // Update the database if needed
                if (data.accountTier !== (isActivePremium ? 'premium' : 'free')) {
                  try {
                    await updateDoc(userDocRef, {
                      accountTier: isActivePremium ? 'premium' : 'free',
                      updatedAt: new Date()
                    });
                  } catch (updateError) {
                    console.error('[AccountContext] Error updating account tier:', updateError);
                  }
                }
              } else {
                setAccountTier('free');
                setSubscription(defaultSubscription);
              }
            } catch (error) {
              console.error('[AccountContext] Error processing account data:', error);
              setAccountTier('free');
              setSubscription(defaultSubscription);
            } finally {
              setIsLoading(false);
            }
          },
          (error) => {
            console.error('[AccountContext] Error in Firestore listener:', error);
            if (isMounted) {
              setAccountTier('free');
              setSubscription(defaultSubscription);
              setIsLoading(false);
            }
          }
        );

        // Store the unsubscribe function
        firestoreListenerRef.current = unsubscribe;
      } catch (error) {
        console.error('[AccountContext] Error initializing account:', error);
        if (isMounted) {
          setAccountTier('free');
          setSubscription(defaultSubscription);
          setIsLoading(false);
        }
      }
    };

    initializeAccount();

    return () => {
      isMounted = false;
      cleanupListener();
    };
  }, [user]);

  const upgradeToPremium = async () => {
    if (!user) throw new Error('Must be logged in to upgrade');

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('[AccountContext] Error upgrading account:', error);
      throw error;
    }
  };

  const cancelSubscription = async () => {
    if (!user) throw new Error('Must be logged in to cancel subscription');
    
    if (!subscription) {
      throw new Error('No subscription information available');
    }

    if (subscription.status === 'canceled') {
      throw new Error('Subscription is already canceled');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('No active subscription ID found. Please contact support.');
    }

    try {
      console.log('[AccountContext] Initiating subscription cancellation:', {
        subscriptionId: subscription.stripeSubscriptionId,
        userId: user.uid,
        currentStatus: subscription.status,
        environment: process.env.NEXT_PUBLIC_CO_DEV_ENV || 'production'
      });
      
      // Special handling for preview environment
      if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
        console.log('[AccountContext] Preview environment detected, using API for database update');
        
        // Even in preview mode, use the API to ensure proper database updates
        const idToken = await user.getIdToken(true); // Force token refresh
        const response = await fetch('/api/stripe/cancel-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            subscriptionId: subscription.stripeSubscriptionId,
            userId: user.uid,
            isPreview: true
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          console.error('[AccountContext] Preview subscription cancellation API error:', data);
          throw new Error(data.message || data.error || 'Failed to cancel subscription');
        }

        console.log('[AccountContext] Preview subscription cancellation successful:', data);
        
        // Update local state with the new subscription status
        setSubscription(prev => ({
          ...prev,
          status: 'canceled',
          endDate: data.endDate,
          renewalDate: data.endDate
        }));
        
        return {
          success: true,
          message: 'Subscription will be canceled at the end of the billing period',
          endDate: data.endDate,
          status: 'canceled',
          isPreview: true
        };
      }
      
      // Production flow
      const idToken = await user.getIdToken(true); // Force token refresh
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          userId: user.uid
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('[AccountContext] Subscription cancellation API error:', data);
        throw new Error(data.message || data.error || 'Failed to cancel subscription');
      }

      console.log('[AccountContext] Subscription cancellation successful:', data);
      
      // Update local state with the new subscription status
      setSubscription(prev => ({
        ...prev,
        status: 'canceled', // Explicitly set to 'canceled' instead of using data.status
        endDate: data.endDate,
        renewalDate: data.endDate // Set renewal date to end date for canceled subscriptions
      }));
      
      // If there was a database error but Stripe cancellation was successful
      if (data.databaseError) {
        console.warn('[AccountContext] Subscription canceled in Stripe but database update failed:', data.databaseError);
        // We could show a warning to the user here if needed
      }

      return data;
    } catch (error: any) {
      console.error('[AccountContext] Error canceling subscription:', error);
      throw error;
    }
  };

  const refreshAccountData = async () => {
    if (!user) return;
    
    // Prevent multiple simultaneous refreshes
    if (isRefreshingRef.current) {
      console.log('[AccountContext] Refresh already in progress, skipping');
      return;
    }
    
    // Prevent refreshing too frequently
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 5000) { // 5 seconds minimum between refreshes
      console.log('[AccountContext] Refresh requested too soon after previous refresh, skipping');
      return;
    }
    
    try {
      isRefreshingRef.current = true;
      lastRefreshTimeRef.current = now;
      
      console.log('[AccountContext] Manually refreshing account data for user:', user.uid);
      setIsLoading(true);
      
      // Force token refresh
      await user.getIdToken(true);
      
      // Get fresh data from Firestore
      const { db } = getFirebaseServices();
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const docSnapshot = await getDoc(userDocRef);
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        
        // Determine account status based on subscription
        const now = new Date();
        const subscriptionData = data.subscription || defaultSubscription;
        const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
        const startDate = subscriptionData.startDate ? new Date(subscriptionData.startDate) : null;
        
        // Check if premium status is still valid
        const isActivePremium = (
          // Stripe subscription checks
          subscriptionData.status === 'active' ||
          (subscriptionData.status === 'canceled' && endDate && endDate > now) ||
          (subscriptionData.stripeSubscriptionId && startDate && startDate <= now && !subscriptionData.status) ||
          
          // Regular subscription checks
          (subscriptionData.stripeSubscriptionId?.startsWith('sub_') && !subscriptionData.stripeSubscriptionId?.includes('admin_')) ||
          
          // Admin-set premium status checks
          (data.accountTier === 'premium' && subscriptionData.manuallyUpdated) ||
          (subscriptionData.currentPlan === 'premium') ||
          (subscriptionData.stripeSubscriptionId?.includes('admin_')) ||
          (data.accountTier === 'premium' && data.subscription?.manuallyUpdated === true)
        );
        
        // Set subscription data with enhanced validation
        const currentStatus = (() => {
          if (subscriptionData.status === 'active') return 'active';
          if (subscriptionData.status === 'canceled' && endDate && endDate > now) return 'canceled';
          if (subscriptionData.stripeSubscriptionId && !subscriptionData.status) return 'active';
          return 'none';
        })();

        // For admin-assigned subscriptions, ensure we have a renewal date
        let renewalDate = subscriptionData.renewalDate;
        if (subscriptionData.stripeSubscriptionId?.includes('admin_') && !renewalDate) {
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1); // Set end date to 1 year from now
          renewalDate = endDate.toISOString();
        }

        const subscriptionDetails = {
          startDate: subscriptionData.startDate,
          endDate: subscriptionData.endDate,
          renewalDate: renewalDate,
          status: currentStatus,
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId
        };
        
        setSubscription(subscriptionDetails);
        setAccountTier(isActivePremium ? 'premium' : 'free');
        
        console.log('[AccountContext] Account data refreshed successfully:', {
          accountTier: isActivePremium ? 'premium' : 'free',
          subscriptionStatus: currentStatus,
          endDate: subscriptionData.endDate || 'none'
        });
      }
    } catch (error) {
      console.error('[AccountContext] Error refreshing account data:', error);
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  };

  const value = {
    accountTier,
    features: ACCOUNT_TIERS[accountTier],
    isLoading,
    subscription,
    upgradeToPremium,
    cancelSubscription,
    refreshAccountData,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}