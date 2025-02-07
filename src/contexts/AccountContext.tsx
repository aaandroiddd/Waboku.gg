import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures, SubscriptionDetails } from '@/types/account';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
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
        const { app } = getFirebaseServices();
        const firestore = getFirestore(app);
        const userDocRef = doc(firestore, 'users', user.uid);

        // Initialize account for new users
        const docSnapshot = await getDoc(userDocRef);
        if (!docSnapshot.exists()) {
          // Set default values for new users
          await setDoc(userDocRef, {
            accountTier: 'free',
            subscription: {
              status: 'none',
              currentPlan: 'free',
              startDate: new Date().toISOString()
            },
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Set up listener for Firestore document changes
        const unsubscribe = onSnapshot(userDocRef, async (doc) => {
          if (!isMounted) return;

          const data = doc.data();
          if (data) {
            // Get subscription data
            const subscriptionData = data.subscription || defaultSubscription;
            
            // Determine account status based on subscription
            const now = new Date();
            const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
            const startDate = subscriptionData.startDate ? new Date(subscriptionData.startDate) : null;
            
            // Enhanced premium status check
            const isActivePremium = (
              // Case 1: Active subscription
              subscriptionData.status === 'active' ||
              // Case 2: Canceled but not expired
              (subscriptionData.status === 'canceled' && endDate && endDate > now) ||
              // Case 3: Has valid subscription ID and start date is valid
              (subscriptionData.stripeSubscriptionId && startDate && startDate <= now) ||
              // Case 4: Explicitly set as premium tier
              data.tier === 'premium'
            );
            
            // Set subscription data with enhanced validation
            const subscriptionStatus = (() => {
              if (subscriptionData.status === 'active') return 'active';
              if (subscriptionData.status === 'canceled' && endDate && endDate > now) return 'canceled';
              if (subscriptionData.stripeSubscriptionId && !subscriptionData.status) return 'active';
              return 'none';
            })();

            const subscriptionDetails = {
              startDate: subscriptionData.startDate,
              endDate: subscriptionData.endDate,
              renewalDate: subscriptionData.renewalDate,
              status: subscriptionStatus,
              stripeSubscriptionId: subscriptionData.stripeSubscriptionId
            };
            
            // Set subscription data
            setSubscription(subscriptionDetails);

            // Set account tier based on enhanced premium status check
            const newTier = isActivePremium ? 'premium' : 'free';
            setAccountTier(newTier);

            // Update the database if there's a mismatch between stored tier and actual status
            if (data.accountTier !== newTier) {
              console.log('Fixing account tier mismatch:', {
                storedTier: data.accountTier,
                calculatedTier: newTier,
                subscriptionStatus,
                hasStripeId: !!subscriptionData.stripeSubscriptionId
              });
              await updateDoc(userDocRef, {
                accountTier: newTier,
                updatedAt: new Date()
              });
            }

            // If the subscription is canceled and past end date, ensure account is set to free
            if (subscriptionData.status === 'canceled' && endDate && endDate <= now) {
              await updateDoc(userDocRef, {
                accountTier: 'free',
                updatedAt: new Date()
              });
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