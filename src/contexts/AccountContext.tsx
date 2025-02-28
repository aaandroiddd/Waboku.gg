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

    const checkSubscriptionStatus = async () => {
      if (!user) return null;
      
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/stripe/check-subscription', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to check subscription status');
        }

        return await response.json();
      } catch (error) {
        console.error('Error checking subscription status:', error);
        return null;
      }
    };

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
            // Check subscription status
            const subscriptionStatus = await checkSubscriptionStatus();
            
            // Get subscription data
            const subscriptionData = subscriptionStatus || data.subscription || defaultSubscription;
            
            // Determine account status based on subscription
            const now = new Date();
            const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
            const startDate = subscriptionData.startDate ? new Date(subscriptionData.startDate) : null;
            
            // Enhanced premium status check
            const isActivePremium = (
              subscriptionData.status === 'active' ||
              (subscriptionData.status === 'canceled' && endDate && endDate > now) ||
              (subscriptionData.stripeSubscriptionId && startDate && startDate <= now && !subscriptionData.status) ||
              (data.accountTier === 'premium' && subscriptionData.manuallyUpdated) ||
              (subscriptionData.currentPlan === 'premium') // Check for currentPlan set by admin
            );
            
            // Set subscription data with enhanced validation
            const currentStatus = (() => {
              if (subscriptionData.status === 'active') return 'active';
              if (subscriptionData.status === 'canceled' && endDate && endDate > now) return 'canceled';
              if (subscriptionData.stripeSubscriptionId && !subscriptionData.status) return 'active';
              return 'none';
            })();

            const subscriptionDetails = {
              startDate: subscriptionData.startDate,
              endDate: subscriptionData.endDate,
              renewalDate: subscriptionData.renewalDate,
              status: currentStatus,
              stripeSubscriptionId: subscriptionData.stripeSubscriptionId
            };
            
            setSubscription(subscriptionDetails);
            setAccountTier(isActivePremium ? 'premium' : 'free');

            // Update the database if needed
            if (data.accountTier !== (isActivePremium ? 'premium' : 'free')) {
              await updateDoc(userDocRef, {
                accountTier: isActivePremium ? 'premium' : 'free',
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
      console.error('Error upgrading account:', error);
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
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      const data = await response.json();
      setSubscription(prev => ({
        ...prev,
        status: 'canceled',
        endDate: data.endDate
      }));

      return data;
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
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