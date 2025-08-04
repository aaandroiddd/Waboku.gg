import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';

/**
 * Reliable Premium Status Hook
 * 
 * This hook provides a single, consistent way to check premium status
 * by using AccountContext as the primary and only source of truth.
 * 
 * Key principles:
 * 1. Single source of truth (AccountContext)
 * 2. No fallback API calls that can cause inconsistencies
 * 3. Simple loading states
 * 4. Consistent error handling
 */

export interface ReliablePremiumStatus {
  isPremium: boolean;
  tier: 'free' | 'premium';
  status: string;
  isLoading: boolean;
  error: string | null;
  subscription: {
    status: string;
    stripeSubscriptionId?: string;
    startDate?: string;
    endDate?: string;
    renewalDate?: string;
    cancelAtPeriodEnd?: boolean;
  };
  refreshStatus: () => Promise<void>;
}

export function useReliablePremiumStatus(): ReliablePremiumStatus {
  const { user } = useAuth();
  const { accountTier, subscription, isLoading: accountLoading, refreshAccountData } = useAccount();
  const [error, setError] = useState<string | null>(null);

  // Clear error when user changes
  useEffect(() => {
    setError(null);
  }, [user?.uid]);

  // Handle refresh with error handling
  const refreshStatus = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);
      await refreshAccountData();
    } catch (err: any) {
      console.error('[useReliablePremiumStatus] Refresh error:', err);
      setError(err.message || 'Failed to refresh account status');
    }
  };

  // Return consistent status based on AccountContext only
  return {
    isPremium: accountTier === 'premium',
    tier: accountTier,
    status: subscription.status,
    isLoading: accountLoading,
    error,
    subscription: {
      status: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      renewalDate: subscription.renewalDate,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    },
    refreshStatus
  };
}