import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { AccountTier } from '@/types/account';

interface PremiumStatusResult {
  isPremium: boolean;
  isLoading: boolean;
  tier: AccountTier;
  lastChecked: number;
  source: 'cache' | 'context' | 'api' | 'fallback';
}

/**
 * Reliable hook for determining premium status with multiple fallbacks
 * This hook provides a more robust way to check premium status by:
 * 1. Using cached data for immediate response
 * 2. Falling back to AccountContext
 * 3. Making direct API calls if needed
 * 4. Implementing proper error handling and retries
 */
export function usePremiumStatus(): PremiumStatusResult {
  const { user } = useAuth();
  const { accountTier, isLoading: isAccountLoading } = useAccount();
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatusResult>({
    isPremium: false,
    isLoading: true,
    tier: 'free',
    lastChecked: 0,
    source: 'fallback'
  });
  
  const lastCheckRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false);
  
  // Function to get cached premium status
  const getCachedStatus = (): { tier: AccountTier; timestamp: number } | null => {
    if (!user?.uid || typeof window === 'undefined') return null;
    
    try {
      const cacheKey = `waboku_premium_status_${user.uid}`;
      const cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();
        const maxAge = 3 * 60 * 1000; // 3 minutes for premium status cache
        
        if (now - data.timestamp < maxAge) {
          return { tier: data.tier, timestamp: data.timestamp };
        }
      }
    } catch (error) {
      console.error('Error reading cached premium status:', error);
    }
    
    return null;
  };
  
  // Function to cache premium status
  const cacheStatus = (tier: AccountTier): void => {
    if (!user?.uid || typeof window === 'undefined') return;
    
    try {
      const cacheKey = `waboku_premium_status_${user.uid}`;
      const data = {
        tier,
        timestamp: Date.now(),
        userId: user.uid
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(data));
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error caching premium status:', error);
    }
  };
  
  // Function to check premium status via API
  const checkPremiumStatusAPI = async (): Promise<AccountTier> => {
    if (!user) throw new Error('No user authenticated');
    
    try {
      const token = await user.getIdToken(true); // Force refresh
      
      const response = await fetch('/api/stripe/check-subscription', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.isPremium ? 'premium' : 'free';
    } catch (error) {
      console.error('Error checking premium status via API:', error);
      throw error;
    }
  };
  
  // Main effect to determine premium status
  useEffect(() => {
    if (!user) {
      setPremiumStatus({
        isPremium: false,
        isLoading: false,
        tier: 'free',
        lastChecked: Date.now(),
        source: 'fallback'
      });
      return;
    }
    
    const updatePremiumStatus = async () => {
      // Prevent multiple simultaneous checks
      if (isCheckingRef.current) return;
      
      const now = Date.now();
      
      // Don't check too frequently (minimum 30 seconds between checks)
      if (now - lastCheckRef.current < 30000) {
        return;
      }
      
      isCheckingRef.current = true;
      lastCheckRef.current = now;
      
      try {
        // Step 1: Try cached data first
        const cached = getCachedStatus();
        if (cached) {
          setPremiumStatus({
            isPremium: cached.tier === 'premium',
            isLoading: false,
            tier: cached.tier,
            lastChecked: cached.timestamp,
            source: 'cache'
          });
          
          // If cache is recent enough, don't check further
          if (now - cached.timestamp < 60000) { // 1 minute
            return;
          }
        }
        
        // Step 2: Use AccountContext if available and not loading
        if (!isAccountLoading && accountTier) {
          const contextTier = accountTier;
          
          setPremiumStatus({
            isPremium: contextTier === 'premium',
            isLoading: false,
            tier: contextTier,
            lastChecked: now,
            source: 'context'
          });
          
          // Cache the result
          cacheStatus(contextTier);
          
          // If we have a definitive answer from context, we're done
          return;
        }
        
        // Step 3: If context is loading or unavailable, try API
        if (isAccountLoading || !accountTier) {
          try {
            const apiTier = await checkPremiumStatusAPI();
            
            setPremiumStatus({
              isPremium: apiTier === 'premium',
              isLoading: false,
              tier: apiTier,
              lastChecked: now,
              source: 'api'
            });
            
            // Cache the result
            cacheStatus(apiTier);
            
          } catch (apiError) {
            console.error('API check failed, using fallback:', apiError);
            
            // Step 4: Fallback to cached data even if expired
            if (cached) {
              setPremiumStatus({
                isPremium: cached.tier === 'premium',
                isLoading: false,
                tier: cached.tier,
                lastChecked: cached.timestamp,
                source: 'cache'
              });
            } else {
              // Final fallback to free tier
              setPremiumStatus({
                isPremium: false,
                isLoading: false,
                tier: 'free',
                lastChecked: now,
                source: 'fallback'
              });
            }
          }
        }
        
      } finally {
        isCheckingRef.current = false;
      }
    };
    
    updatePremiumStatus();
    
    // Set up periodic checks every 2 minutes
    const interval = setInterval(updatePremiumStatus, 2 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      isCheckingRef.current = false;
    };
  }, [user, accountTier, isAccountLoading]);
  
  // Update when AccountContext changes
  useEffect(() => {
    if (!isAccountLoading && accountTier && user) {
      const now = Date.now();
      
      setPremiumStatus(prev => {
        // Only update if the tier actually changed or we don't have recent data
        if (prev.tier !== accountTier || now - prev.lastChecked > 60000) {
          cacheStatus(accountTier);
          
          return {
            isPremium: accountTier === 'premium',
            isLoading: false,
            tier: accountTier,
            lastChecked: now,
            source: 'context'
          };
        }
        
        return prev;
      });
    }
  }, [accountTier, isAccountLoading, user]);
  
  return premiumStatus;
}