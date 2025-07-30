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

    // Try to load cached data first for immediate display
    const loadCachedData = () => {
      try {
        if (typeof window !== 'undefined') {
          const cacheKey = `account_data_${user.uid}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            const cacheAge = Date.now() - parsedCache.timestamp;
            // Use cache if it's less than 5 minutes old
            if (cacheAge < 5 * 60 * 1000) {
              const cachedData = parsedCache.data;
              console.log('[useSimplifiedPremiumStatus] Using cached data for immediate display');
              
              setPremiumStatus({
                isPremium: cachedData.accountTier === 'premium',
                tier: cachedData.accountTier || 'free',
                status: cachedData.subscription?.status || 'none',
                source: 'cache',
                lastChecked: parsedCache.timestamp,
                subscription: cachedData.subscription
              });
              
              // Don't set loading to false yet - we still want fresh data
              return true;
            }
          }
        }
      } catch (error) {
        console.warn('[useSimplifiedPremiumStatus] Error loading cached data:', error);
      }
      return false;
    };

    // Load cached data immediately if available
    const hasCachedData = loadCachedData();

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

    // Fallback to direct API call if AccountContext is still loading and we don't have cached data
    let isMounted = true;

    const checkPremiumStatus = async () => {
      try {
        // Only set loading if we don't have cached data
        if (!hasCachedData) {
          setIsLoading(true);
        }
        
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