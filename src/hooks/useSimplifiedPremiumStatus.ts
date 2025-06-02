import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { getPremiumStatus, clearPremiumStatusCache, PremiumStatusResult } from '@/lib/premium-status';

/**
 * Simplified hook for premium status that uses AccountContext as primary source
 * and falls back to direct API calls when AccountContext is not available
 */
export function useSimplifiedPremiumStatus() {
  const { user } = useAuth();
  const { accountTier, subscription, isLoading: accountLoading } = useAccount();
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatusResult>({
    isPremium: false,
    tier: 'free',
    status: 'none',
    source: 'cache',
    lastChecked: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPremiumStatus({
        isPremium: false,
        tier: 'free',
        status: 'none',
        source: 'error',
        lastChecked: Date.now()
      });
      setIsLoading(false);
      return;
    }

    // If AccountContext is available and not loading, use it as the primary source
    if (!accountLoading) {
      const isPremium = accountTier === 'premium';
      setPremiumStatus({
        isPremium,
        tier: accountTier,
        status: subscription.status,
        source: 'account-context',
        lastChecked: Date.now(),
        subscription: {
          status: subscription.status,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          renewalDate: subscription.renewalDate
        }
      });
      setIsLoading(false);
      
      // Clear any cached data since we have fresh data from AccountContext
      clearPremiumStatusCache(user.uid);
      
      console.log('[useSimplifiedPremiumStatus] Using AccountContext data:', {
        isPremium,
        tier: accountTier,
        status: subscription.status,
        source: 'account-context'
      });
      
      return;
    }

    // Fallback to direct API call if AccountContext is still loading
    let isMounted = true;

    const checkPremiumStatus = async () => {
      try {
        setIsLoading(true);
        const status = await getPremiumStatus(user.uid);
        
        if (isMounted) {
          setPremiumStatus(status);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useSimplifiedPremiumStatus] Error:', error);
        if (isMounted) {
          setPremiumStatus({
            isPremium: false,
            tier: 'free',
            status: 'error',
            source: 'error',
            lastChecked: Date.now()
          });
          setIsLoading(false);
        }
      }
    };

    // Only use fallback if AccountContext is still loading
    if (accountLoading) {
      checkPremiumStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [user, accountTier, subscription, accountLoading]);

  // Function to manually refresh status
  const refreshStatus = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      clearPremiumStatusCache(user.uid);
      const status = await getPremiumStatus(user.uid, true);
      setPremiumStatus(status);
    } catch (error) {
      console.error('[useSimplifiedPremiumStatus] Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isPremium: premiumStatus.isPremium,
    tier: premiumStatus.tier,
    status: premiumStatus.status,
    isLoading,
    lastChecked: premiumStatus.lastChecked,
    source: premiumStatus.source,
    subscription: premiumStatus.subscription,
    refreshStatus
  };
}