import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures, SubscriptionDetails } from '@/types/account';
import { getDatabase, ref, onValue, off, set } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';

interface AccountContextType {
  accountTier: AccountTier;
  features: AccountFeatures;
  isLoading: boolean;
  subscription: SubscriptionDetails;
  upgradeToPremium: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
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
};

const AccountContext = createContext<AccountContextType>(defaultContext);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accountTier, setAccountTier] = useState<AccountTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails>(defaultSubscription);

  useEffect(() => {
    let isMounted = true;

    const initializeAccount = async () => {
      if (!user) {
        if (isMounted) {
          setAccountTier('free');
          setSubscription(defaultSubscription);
          setIsLoading(false);
        }
        return;
      }

      try {
        const { db: realtimeDb } = getFirebaseServices();
        const accountRef = ref(realtimeDb, `users/${user.uid}/account`);

        // Initialize account for new users
        const snapshot = await new Promise((resolve) => {
          const unsubscribe = onValue(accountRef, (snapshot) => {
            unsubscribe();
            resolve(snapshot);
          }, {
            onlyOnce: true
          });
        });

        if (!snapshot || !(snapshot as any).exists()) {
          // Set default values for new users
          const defaultAccount = {
            tier: 'free',
            subscription: {
              status: 'none',
              currentPlan: 'free',
              startDate: new Date().toISOString()
            }
          };
          await set(accountRef, defaultAccount);
          if (isMounted) {
            setAccountTier('free');
            setSubscription({
              status: 'none',
              currentPlan: 'free',
              startDate: new Date().toISOString()
            });
          }
        }

        // Set up listener for account changes
        const unsubscribe = onValue(accountRef, (snapshot) => {
          if (!isMounted) return;

          const data = snapshot.val();
          if (data) {
            // Get subscription data
            const subscriptionData = data.subscription || defaultSubscription;
            
            // Determine account status based on subscription
            const now = new Date();
            const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
            
            // A user is premium if:
            // 1. They have an active subscription OR
            // 2. They have a canceled subscription but the end date hasn't been reached
            const isActivePremium = 
              subscriptionData.status === 'active' || 
              (subscriptionData.status === 'canceled' && endDate && endDate > now);
            
            // Set subscription data
            setSubscription({
              startDate: subscriptionData.startDate,
              endDate: subscriptionData.endDate,
              renewalDate: subscriptionData.renewalDate,
              status: subscriptionData.status || 'none',
              stripeSubscriptionId: subscriptionData.stripeSubscriptionId
            });

            // Set account tier based on subscription status
            setAccountTier(isActivePremium ? 'premium' : 'free');

            // If the subscription is canceled and past end date, ensure account is set to free
            if (subscriptionData.status === 'canceled' && endDate && endDate <= now) {
              set(ref(realtimeDb, `users/${user.uid}/account/tier`), 'free');
            }
          } else {
            setAccountTier('free');
            setSubscription(defaultSubscription);
          }
          setIsLoading(false);
        }, (error) => {
          console.error('Error loading account tier:', error);
          if (isMounted) {
            setAccountTier('free');
            setSubscription(defaultSubscription);
            setIsLoading(false);
          }
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing account:', error);
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
    };
  }, [user]);

  const upgradeToPremium = async () => {
    if (!user) throw new Error('Must be logged in to upgrade');

    try {
      // The actual upgrade is handled by the Stripe checkout or dev-success endpoint
      // This method is kept for potential direct upgrades in the future
      setAccountTier('premium');
    } catch (error) {
      console.error('Error upgrading account:', error);
      throw error;
    }
  };

  const cancelSubscription = async () => {
    if (!user) throw new Error('Must be logged in to cancel subscription');
    
    console.log('Attempting to cancel subscription:', {
      userId: user.uid,
      currentSubscription: subscription,
      accountTier
    });

    // Validate subscription state
    if (!subscription) {
      throw new Error('No subscription information available');
    }

    if (subscription.status === 'canceled') {
      throw new Error('Subscription is already canceled');
    }

    if (!subscription.stripeSubscriptionId) {
      console.error('Missing subscription ID:', {
        subscription,
        accountTier,
        userId: user.uid
      });
      throw new Error('No active subscription ID found. Please contact support.');
    }

    try {
      // Add retry logic for network issues
      const MAX_RETRIES = 3;
      let attempt = 0;
      let lastError;

      while (attempt < MAX_RETRIES) {
        try {
          const response = await fetch('/api/stripe/cancel-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscriptionId: subscription.stripeSubscriptionId,
              userId: user.uid
            }),
            // Add credentials and cache control
            credentials: 'include',
            cache: 'no-cache',
          });

          const responseData = await response.json();
          
          if (!response.ok) {
            console.error('Server responded with error:', {
              status: response.status,
              data: responseData,
              subscription,
              userId: user.uid,
              attempt: attempt + 1
            });

            // Handle specific error cases
            if (responseData.code === 'ALREADY_CANCELED') {
              throw new Error('This subscription has already been canceled');
            } else if (responseData.code === 'NO_SUBSCRIPTION_DATA') {
              throw new Error('No active subscription found. Please contact support.');
            } else if (responseData.code === 'SUBSCRIPTION_NOT_FOUND') {
              throw new Error('Subscription not found in our records. Please contact support.');
            }

            throw new Error(responseData.error || 'Failed to cancel subscription');
          }

          // Update local state immediately for better UX
          const newEndDate = responseData.endDate || subscription.endDate;
          setSubscription(prev => ({
            ...prev,
            status: 'canceled',
            endDate: newEndDate
          }));

          // Only update account tier to free if the end date has passed
          const now = new Date();
          const endDate = newEndDate ? new Date(newEndDate) : null;
          if (endDate && endDate <= now) {
            setAccountTier('free');
          }

          return responseData;
        } catch (error: any) {
          lastError = error;
          
          // Only retry on network errors
          if (!error.message.includes('Failed to fetch')) {
            throw error;
          }
          
          console.warn(`Attempt ${attempt + 1} failed:`, error);
          attempt++;
          
          if (attempt < MAX_RETRIES) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      }

      // If we've exhausted all retries
      console.error('All retry attempts failed:', {
        error: lastError,
        subscription,
        userId: user.uid
      });
      throw new Error('Network error: Unable to reach the server after multiple attempts. Please try again later.');
    } catch (error: any) {
      console.error('Error in cancelSubscription:', {
        error: error.message,
        subscription,
        userId: user.uid
      });
      throw error;
    }
  };

  const value = {
    accountTier,
    features: ACCOUNT_TIERS[accountTier],
    isLoading,
    subscription,
    upgradeToPremium,
    cancelSubscription,
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