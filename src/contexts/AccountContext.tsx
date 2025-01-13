import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures } from '@/types/account';

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
    const loadAccountTier = async () => {
      if (!user) {
        setAccountTier('free');
        setIsLoading(false);
        return;
      }

      try {
        // TODO: Implement actual account tier fetching from your backend
        // For now, we'll default to free
        setAccountTier('free');
      } catch (error) {
        console.error('Error loading account tier:', error);
        setAccountTier('free');
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountTier();
  }, [user]);

  const upgradeToPremium = async () => {
    if (!user) throw new Error('Must be logged in to upgrade');

    try {
      // TODO: Implement actual premium upgrade logic
      // This should integrate with your payment processing system
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