/**
 * Simplified Premium Status Management
 * 
 * This module provides a single, reliable way to determine premium status
 * by consolidating all the logic into one place and eliminating race conditions.
 */

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from './firebase';

export interface PremiumStatusResult {
  isPremium: boolean;
  tier: 'free' | 'premium';
  status: string;
  source: 'firestore' | 'api' | 'cache' | 'error';
  lastChecked: number;
  subscription?: {
    status: string;
    stripeSubscriptionId?: string;
    startDate?: string;
    endDate?: string;
    renewalDate?: string;
  };
}

// Cache for premium status (in-memory, per session)
const premiumStatusCache = new Map<string, { data: PremiumStatusResult; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

/**
 * Get premium status with simplified logic
 */
export async function getPremiumStatus(userId: string, forceRefresh = false): Promise<PremiumStatusResult> {
  if (!userId) {
    return {
      isPremium: false,
      tier: 'free',
      status: 'none',
      source: 'error',
      lastChecked: Date.now()
    };
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = premiumStatusCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return { ...cached.data, source: 'cache' };
    }
  }

  try {
    // Get data directly from Firestore (single source of truth)
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore not available');
    }

    const userDocRef = doc(db, 'users', userId);
    const docSnapshot = await getDoc(userDocRef);
    
    if (!docSnapshot.exists()) {
      const result: PremiumStatusResult = {
        isPremium: false,
        tier: 'free',
        status: 'none',
        source: 'firestore',
        lastChecked: Date.now()
      };
      
      // Cache the result
      premiumStatusCache.set(userId, { data: result, timestamp: Date.now() });
      return result;
    }

    const userData = docSnapshot.data();
    const accountTier = userData.accountTier || 'free';
    const subscription = userData.subscription || {};

    // Simplified premium status determination
    const isPremium = determinePremiumStatus(accountTier, subscription);
    
    const result: PremiumStatusResult = {
      isPremium,
      tier: isPremium ? 'premium' : 'free',
      status: subscription.status || 'none',
      source: 'firestore',
      lastChecked: Date.now(),
      subscription: {
        status: subscription.status || 'none',
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        renewalDate: subscription.renewalDate
      }
    };

    // Cache the result
    premiumStatusCache.set(userId, { data: result, timestamp: Date.now() });
    
    console.log('[Premium Status] Determined status:', {
      userId,
      isPremium,
      tier: result.tier,
      status: result.status,
      accountTier,
      subscriptionStatus: subscription.status
    });

    return result;

  } catch (error) {
    console.error('[Premium Status] Error getting status:', error);
    
    // Return cached data if available, otherwise default to free
    const cached = premiumStatusCache.get(userId);
    if (cached) {
      return { ...cached.data, source: 'cache' };
    }

    return {
      isPremium: false,
      tier: 'free',
      status: 'error',
      source: 'error',
      lastChecked: Date.now()
    };
  }
}

/**
 * Simplified logic to determine if user has premium status
 */
function determinePremiumStatus(accountTier: string, subscription: any): boolean {
  // If account tier is explicitly set to premium
  if (accountTier === 'premium') {
    // Check if subscription is active or within valid period
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return true;
    }
    
    // Check if subscription is canceled but still within paid period
    if (subscription.status === 'canceled' && subscription.endDate) {
      const endDate = new Date(subscription.endDate);
      const now = new Date();
      if (now < endDate) {
        return true;
      }
    }
    
    // Admin-assigned premium (no expiration check needed)
    if (subscription.stripeSubscriptionId?.startsWith('admin_')) {
      return true;
    }
    
    // Manually updated premium status
    if (subscription.manuallyUpdated && subscription.currentPlan === 'premium') {
      return true;
    }
  }

  return false;
}

/**
 * Clear premium status cache for a user
 */
export function clearPremiumStatusCache(userId: string): void {
  premiumStatusCache.delete(userId);
}

/**
 * Clear all premium status cache
 */
export function clearAllPremiumStatusCache(): void {
  premiumStatusCache.clear();
}

/**
 * Invalidate cache and update with new status immediately
 */
export function updatePremiumStatusCache(userId: string, newStatus: Partial<PremiumStatusResult>): void {
  const existing = premiumStatusCache.get(userId);
  const updated: PremiumStatusResult = {
    isPremium: false,
    tier: 'free',
    status: 'none',
    source: 'cache',
    lastChecked: Date.now(),
    ...existing?.data,
    ...newStatus,
    lastChecked: Date.now()
  };
  
  premiumStatusCache.set(userId, { data: updated, timestamp: Date.now() });
  
  console.log('[Premium Status] Cache updated for user:', {
    userId,
    newStatus: updated
  });
}

/**
 * Get cached premium status without making any API calls
 */
export function getCachedPremiumStatus(userId: string): PremiumStatusResult | null {
  const cached = premiumStatusCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return { ...cached.data, source: 'cache' };
  }
  return null;
}