import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures, SubscriptionDetails } from '@/types/account';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { initializeApp } from 'firebase/app';

interface AccountContextType {
  accountTier: AccountTier;
  features: AccountFeatures;
  isLoading: boolean;
  subscription: SubscriptionDetails;
  upgradeToPremium: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accountTier, setAccountTier] = useState<AccountTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails>({
    status: 'none',
    stripeSubscriptionId: undefined,
    startDate: undefined,
    endDate: undefined,
    renewalDate: undefined
  });

  useEffect(() => {
    if (!user) {
      setAccountTier('free');
      setSubscription({ status: 'none' });
      setIsLoading(false);
      return;
    }

    const db = getDatabase();
    const accountRef = ref(db, `users/${user.uid}/account`);

    // Listen for account changes
    const unsubscribe = onValue(accountRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAccountTier(data.tier as AccountTier || 'free');
        
        // Handle subscription data
        if (data.subscription) {
          setSubscription({
            startDate: data.subscription.startDate,
            endDate: data.subscription.endDate,
            renewalDate: data.subscription.renewalDate,
            status: data.subscription.status || 'none',
            stripeSubscriptionId: data.subscription.stripeSubscriptionId
          });
        } else {
          setSubscription({ status: 'none' });
        }
      } else {
        setAccountTier('free');
        setSubscription({ status: 'none' });
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading account tier:', error);
      setAccountTier('free');
      setSubscription({ status: 'none' });
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => {
      off(accountRef);
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
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          userId: user.uid
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Server responded with error:', {
          status: response.status,
          data: responseData,
          subscription,
          userId: user.uid
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
      setSubscription(prev => ({
        ...prev,
        status: 'canceled',
        endDate: responseData.endDate || prev.endDate
      }));

      // Update account tier to free
      setAccountTier('free');

      return responseData;
    } catch (error: any) {
      console.error('Error in cancelSubscription:', {
        error: error.message,
        subscription,
        userId: user.uid
      });
      throw error;
    }
  };

  return (
    <AccountContext.Provider
      value={{
        accountTier,
        features: ACCOUNT_TIERS[accountTier],
        isLoading,
        subscription,
        upgradeToPremium,
        cancelSubscription,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}