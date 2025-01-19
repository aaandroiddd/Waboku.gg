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
    status: 'none'
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
    if (!subscription.stripeSubscriptionId) throw new Error('No active subscription found');

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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      const result = await response.json();
      
      // The actual status update will come through the Firebase listener
      // but we can also update the local state for immediate feedback
      setSubscription(prev => ({
        ...prev,
        status: 'canceled',
        endDate: result.endDate || prev.endDate
      }));
    } catch (error) {
      console.error('Error canceling subscription:', error);
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