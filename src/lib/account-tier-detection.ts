/**
 * Centralized Account Tier Detection System
 * 
 * This module provides a single, reliable way to determine account tiers
 * by consolidating all logic into one place and eliminating complexity.
 * 
 * Key principles:
 * 1. Single source of truth (Firestore users collection)
 * 2. Simple, predictable logic
 * 3. Efficient caching to reduce database calls
 * 4. Consistent error handling
 */

import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { AccountTier } from '@/types/account';

// In-memory cache for account tiers (per-process cache for server-side)
const accountTierCache = new Map<string, { tier: AccountTier; timestamp: number; subscription?: any }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

/**
 * Simple interface for account tier result
 */
export interface AccountTierResult {
  tier: AccountTier;
  isPremium: boolean;
  source: 'cache' | 'database' | 'error';
  lastChecked: number;
  subscription?: {
    status: string;
    stripeSubscriptionId?: string;
    endDate?: string;
    renewalDate?: string;
  };
}

/**
 * Centralized function to determine user account tier
 * This is the ONLY function that should be used for account tier detection
 */
export async function getUserAccountTier(userId: string, forceRefresh = false): Promise<AccountTierResult> {
  if (!userId || typeof userId !== 'string') {
    console.warn('[AccountTier] Invalid userId provided:', userId);
    return {
      tier: 'free',
      isPremium: false,
      source: 'error',
      lastChecked: Date.now()
    };
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = accountTierCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return {
        tier: cached.tier,
        isPremium: cached.tier === 'premium',
        source: 'cache',
        lastChecked: cached.timestamp,
        subscription: cached.subscription
      };
    }
  }

  try {
    console.log(`[AccountTier] Fetching account tier for user ${userId}`);
    
    const { db } = getFirebaseAdmin();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`[AccountTier] User document not found for ${userId}, defaulting to free`);
      const result: AccountTierResult = {
        tier: 'free',
        isPremium: false,
        source: 'database',
        lastChecked: Date.now()
      };
      
      // Cache the result
      accountTierCache.set(userId, { 
        tier: 'free', 
        timestamp: Date.now() 
      });
      
      return result;
    }
    
    const userData = userDoc.data();
    if (!userData) {
      console.log(`[AccountTier] Empty user data for ${userId}, defaulting to free`);
      const result: AccountTierResult = {
        tier: 'free',
        isPremium: false,
        source: 'database',
        lastChecked: Date.now()
      };
      
      // Cache the result
      accountTierCache.set(userId, { 
        tier: 'free', 
        timestamp: Date.now() 
      });
      
      return result;
    }
    
    // Determine account tier using simplified logic
    const tier = determineAccountTierFromUserData(userData);
    const subscription = userData.subscription || {};
    
    const result: AccountTierResult = {
      tier,
      isPremium: tier === 'premium',
      source: 'database',
      lastChecked: Date.now(),
      subscription: {
        status: subscription.status || 'none',
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        endDate: subscription.endDate,
        renewalDate: subscription.renewalDate
      }
    };
    
    // Cache the result
    accountTierCache.set(userId, { 
      tier, 
      timestamp: Date.now(),
      subscription: result.subscription
    });
    
    console.log(`[AccountTier] Determined tier for user ${userId}:`, {
      tier,
      isPremium: tier === 'premium',
      subscriptionStatus: subscription.status,
      source: 'database'
    });
    
    return result;
    
  } catch (error: any) {
    console.error(`[AccountTier] Error determining account tier for user ${userId}:`, error);
    
    // Return cached data if available, otherwise default to free
    const cached = accountTierCache.get(userId);
    if (cached) {
      return {
        tier: cached.tier,
        isPremium: cached.tier === 'premium',
        source: 'cache',
        lastChecked: cached.timestamp,
        subscription: cached.subscription
      };
    }
    
    return {
      tier: 'free',
      isPremium: false,
      source: 'error',
      lastChecked: Date.now()
    };
  }
}

/**
 * Simplified logic to determine account tier from user data
 * This consolidates all the complex logic into one predictable function
 */
function determineAccountTierFromUserData(userData: any): AccountTier {
  const accountTier = userData.accountTier || 'free';
  const subscription = userData.subscription || {};
  const now = new Date();
  
  // If explicitly set to free, return free
  if (accountTier === 'free') {
    return 'free';
  }
  
  // If explicitly set to premium, check if it's valid
  if (accountTier === 'premium') {
    // Active or trialing subscriptions are always premium
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return 'premium';
    }
    
    // Admin-assigned premium (no expiration)
    if (subscription.stripeSubscriptionId?.startsWith('admin_')) {
      return 'premium';
    }
    
    // Manually updated premium (no expiration)
    if (subscription.manuallyUpdated && subscription.currentPlan === 'premium') {
      return 'premium';
    }
    
    // Canceled subscription but still within paid period
    if (subscription.status === 'canceled') {
      // Check both endDate and renewalDate
      const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
      const renewalDate = subscription.renewalDate ? new Date(subscription.renewalDate) : null;
      
      if (endDate && now < endDate) {
        return 'premium';
      }
      
      if (renewalDate && now < renewalDate) {
        return 'premium';
      }
    }
  }
  
  // Default to free for all other cases
  return 'free';
}

/**
 * Batch function to get account tiers for multiple users
 * More efficient than individual calls when processing many users
 */
export async function getBatchAccountTiers(userIds: string[]): Promise<Map<string, AccountTierResult>> {
  const results = new Map<string, AccountTierResult>();
  
  if (!userIds || userIds.length === 0) {
    return results;
  }
  
  // Filter out invalid user IDs
  const validUserIds = userIds.filter(id => id && typeof id === 'string');
  
  if (validUserIds.length === 0) {
    return results;
  }
  
  try {
    console.log(`[AccountTier] Batch fetching account tiers for ${validUserIds.length} users`);
    
    const { db } = getFirebaseAdmin();
    
    // Process in chunks of 10 (Firestore limit for 'in' queries)
    const chunks = [];
    for (let i = 0; i < validUserIds.length; i += 10) {
      chunks.push(validUserIds.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      const snapshot = await db.collection('users')
        .where('__name__', 'in', chunk.map(id => db.collection('users').doc(id)))
        .get();
      
      // Process each document
      snapshot.docs.forEach(doc => {
        const userData = doc.data();
        const userId = doc.id;
        
        if (userData) {
          const tier = determineAccountTierFromUserData(userData);
          const subscription = userData.subscription || {};
          
          const result: AccountTierResult = {
            tier,
            isPremium: tier === 'premium',
            source: 'database',
            lastChecked: Date.now(),
            subscription: {
              status: subscription.status || 'none',
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              endDate: subscription.endDate,
              renewalDate: subscription.renewalDate
            }
          };
          
          results.set(userId, result);
          
          // Cache the result
          accountTierCache.set(userId, { 
            tier, 
            timestamp: Date.now(),
            subscription: result.subscription
          });
        } else {
          // User exists but no data
          const result: AccountTierResult = {
            tier: 'free',
            isPremium: false,
            source: 'database',
            lastChecked: Date.now()
          };
          
          results.set(userId, result);
          
          // Cache the result
          accountTierCache.set(userId, { 
            tier: 'free', 
            timestamp: Date.now() 
          });
        }
      });
      
      // Handle users not found in this chunk
      chunk.forEach(userId => {
        if (!results.has(userId)) {
          const result: AccountTierResult = {
            tier: 'free',
            isPremium: false,
            source: 'database',
            lastChecked: Date.now()
          };
          
          results.set(userId, result);
          
          // Cache the result
          accountTierCache.set(userId, { 
            tier: 'free', 
            timestamp: Date.now() 
          });
        }
      });
    }
    
    console.log(`[AccountTier] Batch processed ${results.size} account tiers`);
    
  } catch (error: any) {
    console.error('[AccountTier] Error in batch account tier fetch:', error);
    
    // Return free tier for all users on error
    validUserIds.forEach(userId => {
      if (!results.has(userId)) {
        results.set(userId, {
          tier: 'free',
          isPremium: false,
          source: 'error',
          lastChecked: Date.now()
        });
      }
    });
  }
  
  return results;
}

/**
 * Clear account tier cache for a specific user
 */
export function clearAccountTierCache(userId: string): void {
  accountTierCache.delete(userId);
  console.log(`[AccountTier] Cleared cache for user ${userId}`);
}

/**
 * Clear all account tier cache
 */
export function clearAllAccountTierCache(): void {
  accountTierCache.clear();
  console.log('[AccountTier] Cleared all account tier cache');
}

/**
 * Get cached account tier without making database calls
 */
export function getCachedAccountTier(userId: string): AccountTierResult | null {
  const cached = accountTierCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return {
      tier: cached.tier,
      isPremium: cached.tier === 'premium',
      source: 'cache',
      lastChecked: cached.timestamp,
      subscription: cached.subscription
    };
  }
  return null;
}

/**
 * Update account tier cache immediately (useful after subscription changes)
 */
export function updateAccountTierCache(userId: string, tier: AccountTier, subscription?: any): void {
  accountTierCache.set(userId, { 
    tier, 
    timestamp: Date.now(),
    subscription
  });
  console.log(`[AccountTier] Updated cache for user ${userId} to ${tier}`);
}

/**
 * Get cache statistics for debugging
 */
export function getAccountTierCacheStats(): { size: number; entries: Array<{ userId: string; tier: AccountTier; age: number }> } {
  const now = Date.now();
  const entries = Array.from(accountTierCache.entries()).map(([userId, data]) => ({
    userId,
    tier: data.tier,
    age: now - data.timestamp
  }));
  
  return {
    size: accountTierCache.size,
    entries
  };
}