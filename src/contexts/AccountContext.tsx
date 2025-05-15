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
  renewalDate: undefined,
  cancelAtPeriodEnd: false
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
        
        // Get a fresh token to ensure we have the latest authentication
        let idToken;
        try {
          idToken = await user.getIdToken(true);
          console.log('Successfully obtained fresh ID token for subscription check');
        } catch (tokenError) {
          console.error('Error getting fresh ID token:', tokenError);
          // Fall back to regular token if refresh fails
          idToken = await user.getIdToken();
        }
        
        // Add timeout and retry logic for better network resilience
        let attempts = 0;
        const maxAttempts = 3; // Increased back to 3 attempts for better reliability
        
        while (attempts < maxAttempts) {
          try {
            console.log(`Attempting to check subscription status (attempt ${attempts + 1}/${maxAttempts})...`);
            
            // Use AbortController to implement timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              controller.abort();
              console.warn(`Subscription check timed out (attempt ${attempts + 1})`);
            }, 10000); // Increased back to 10s for better reliability
            
            // Make the fetch request with more detailed logging
            console.log(`Making fetch request to /api/stripe/check-subscription (attempt ${attempts + 1})`);
            const response = await fetch('/api/stripe/check-subscription', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              signal: controller.signal,
              // Ensure we're not using cached responses
              cache: 'no-store'
            });
            
            // Clear the timeout
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              let errorData;
              try {
                errorData = await response.json();
              } catch (parseError) {
                errorData = { message: 'Failed to parse error response' };
              }
              
              console.warn(`Subscription check failed with status ${response.status}:`, errorData);
              
              // For 401 errors, we might need a new token
              if (response.status === 401) {
                // Try to get a fresh token for the next attempt
                if (attempts < maxAttempts - 1) {
                  console.log('Auth error detected, refreshing token for next attempt');
                  try {
                    idToken = await user.getIdToken(true);
                  } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                  }
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
            
            // Successfully got a response, parse the JSON
            let data;
            try {
              data = await response.json();
              console.log('Subscription check successful:', {
                isPremium: data.isPremium,
                status: data.status,
                tier: data.tier
              });
              return data;
            } catch (jsonError) {
              console.error('Error parsing subscription check response:', jsonError);
              throw new Error('Failed to parse subscription data');
            }
            
          } catch (fetchError: any) {
            attempts++;
            console.error(`Subscription check attempt ${attempts} failed:`, {
              error: fetchError.message,
              name: fetchError.name,
              stack: fetchError.stack?.split('\n')[0]
            });
            
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
                                  fetchError.message.includes('fetch') ||
                                  fetchError.message.includes('Failed to fetch');
            
            if (isNetworkError) {
              const delay = Math.min(1000 * Math.pow(2, attempts), 5000); // Increased max delay to 5s
              console.log(`Network error, waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // This should never be reached due to the return in the loop
        console.warn('Reached end of subscription check function without returning data');
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
            // Set default values for new users with explicit free tier settings
            await setDoc(userDocRef, {
              accountTier: 'free',
              subscription: {
                status: 'none',
                startDate: new Date().toISOString(),
                currentPlan: 'free',
                tier: 'free',
                stripeSubscriptionId: null,
                manuallyUpdated: false
              },
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            console.log('[AccountContext] Created new user document with explicit free tier settings');
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
                
                // More strict premium status check with validation
                let isActivePremium = (
                  // Must have an active status AND one of the following conditions
                  (subscriptionData.status === 'active' && (
                    // Regular Stripe subscription
                    (subscriptionData.stripeSubscriptionId?.startsWith('sub_') && !subscriptionData.stripeSubscriptionId?.includes('admin_')) ||
                    // Admin-assigned subscription with proper format
                    (subscriptionData.stripeSubscriptionId?.startsWith('admin_')) ||
                    // Explicitly set premium plan with manual update flag
                    (subscriptionData.currentPlan === 'premium' && subscriptionData.manuallyUpdated === true)
                  )) ||
                  // Special case for canceled but still valid subscriptions
                  (subscriptionData.status === 'canceled' && endDate && endDate > now && subscriptionData.stripeSubscriptionId)
                );
                
                // Additional validation to prevent incorrect premium status
                if (isActivePremium) {
                  // Double-check that we have valid premium indicators
                  const hasPremiumIndicators = 
                    subscriptionData.stripeSubscriptionId || 
                    (subscriptionData.currentPlan === 'premium' && subscriptionData.manuallyUpdated) ||
                    (data.accountTier === 'premium' && data.subscription?.manuallyUpdated === true);
                  
                  if (!hasPremiumIndicators) {
                    console.warn('[AccountContext] Prevented incorrect premium status assignment for user:', user.uid);
                    isActivePremium = false;
                  }
                }
                
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
                  stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
                  cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false
                };
                
                setSubscription(subscriptionDetails);
                setAccountTier(isActivePremium ? 'premium' : 'free');

                // Update the database if needed
                if (data.accountTier !== (isActivePremium ? 'premium' : 'free')) {
                  try {
                    const newTier = isActivePremium ? 'premium' : 'free';
                    
                    // Update user document with new tier
                    await updateDoc(userDocRef, {
                      accountTier: newTier,
                      updatedAt: new Date()
                    });
                    
                    // Also update all active listings to reflect the new tier
                    try {
                      const idToken = await user.getIdToken(true);
                      const response = await fetch('/api/stripe/update-listing-tiers', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({
                          accountTier: newTier
                        })
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        console.log(`[AccountContext] Updated ${result.updated} listings to ${newTier} tier`);
                      } else {
                        console.error('[AccountContext] Failed to update listing tiers:', await response.text());
                      }
                    } catch (listingUpdateError) {
                      console.error('[AccountContext] Error updating listing tiers:', listingUpdateError);
                    }
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
          renewalDate: data.endDate,
          cancelAtPeriodEnd: true
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
        renewalDate: data.endDate, // Set renewal date to end date for canceled subscriptions
        cancelAtPeriodEnd: true
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
        
        // Use the same improved premium status check logic
        let isActivePremium = (
          // Must have an active status AND one of the following conditions
          (subscriptionData.status === 'active' && (
            // Regular Stripe subscription
            (subscriptionData.stripeSubscriptionId?.startsWith('sub_') && !subscriptionData.stripeSubscriptionId?.includes('admin_')) ||
            // Admin-assigned subscription with proper format
            (subscriptionData.stripeSubscriptionId?.startsWith('admin_')) ||
            // Explicitly set premium plan with manual update flag
            (subscriptionData.currentPlan === 'premium' && subscriptionData.manuallyUpdated === true)
          )) ||
          // Special case for canceled but still valid subscriptions
          (subscriptionData.status === 'canceled' && endDate && endDate > now && subscriptionData.stripeSubscriptionId)
        );
        
        // Additional validation to prevent incorrect premium status
        if (isActivePremium) {
          // Double-check that we have valid premium indicators
          const hasPremiumIndicators = 
            subscriptionData.stripeSubscriptionId || 
            (subscriptionData.currentPlan === 'premium' && subscriptionData.manuallyUpdated) ||
            (data.accountTier === 'premium' && data.subscription?.manuallyUpdated === true);
          
          if (!hasPremiumIndicators) {
            console.warn('[AccountContext] Prevented incorrect premium status assignment during refresh for user:', user.uid);
            isActivePremium = false;
          }
        }
        
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
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false
        };
        
        setSubscription(subscriptionDetails);
        const newTier = isActivePremium ? 'premium' : 'free';
        setAccountTier(newTier);
        
        console.log('[AccountContext] Account data refreshed successfully:', {
          accountTier: newTier,
          subscriptionStatus: currentStatus,
          endDate: subscriptionData.endDate || 'none'
        });
        
        // Update user document if needed
        if (data.accountTier !== newTier) {
          try {
            // Update user document with new tier
            await updateDoc(userDocRef, {
              accountTier: newTier,
              updatedAt: new Date()
            });
            
            // Also update all active listings to reflect the new tier
            try {
              const idToken = await user.getIdToken(true);
              const response = await fetch('/api/stripe/update-listing-tiers', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                  accountTier: newTier
                })
              });
              
              if (response.ok) {
                const result = await response.json();
                console.log(`[AccountContext] Updated ${result.updated} listings to ${newTier} tier during refresh`);
              } else {
                console.error('[AccountContext] Failed to update listing tiers during refresh:', await response.text());
              }
            } catch (listingUpdateError) {
              console.error('[AccountContext] Error updating listing tiers during refresh:', listingUpdateError);
            }
          } catch (updateError) {
            console.error('[AccountContext] Error updating account tier during refresh:', updateError);
          }
        }
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