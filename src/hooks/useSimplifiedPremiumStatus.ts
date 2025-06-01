import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPremiumStatus, clearPremiumStatusCache, PremiumStatusResult } from '@/lib/premium-status';

/**
 * Simplified hook for premium status that uses a single source of truth
 */
export function useSimplifiedPremiumStatus() {
  const { user } = useAuth();
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

    checkPremiumStatus();

    // Set up periodic refresh every 5 minutes
    const interval = setInterval(checkPremiumStatus, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

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