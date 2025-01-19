import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures } from '@/types/account';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { initializeApp } from 'firebase/app';

interface AccountContextType {
  accountTier: AccountTier;
  features: AccountFeatures;
  isLoading: boolean;
  upgradeToPremium: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accountTier, setAccountTier] = useState<AccountTier>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccountTier('free');
      setIsLoading(false);
      return;
    }

    const db = getDatabase();
    const accountRef = ref(db, `users/${user.uid}/account`);

    // Listen for account changes
    const unsubscribe = onValue(accountRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.tier) {
        setAccountTier(data.tier as AccountTier);
      } else {
        setAccountTier('free');
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading account tier:', error);
      setAccountTier('free');
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

  return (
    <AccountContext.Provider
      value={{
        accountTier,
        features: ACCOUNT_TIERS[accountTier],
        isLoading,
        upgradeToPremium,
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