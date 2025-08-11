import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { sellerLevelCache } from '@/lib/seller-level-cache';
import { 
  SellerLevel, 
  SellerLevelData, 
  SELLER_LEVEL_CONFIG, 
  calculateSellerLevel, 
  canAdvanceToNextLevel, 
  getNextLevelRequirements 
} from '@/types/seller-level';
import { 
  enforceSellerLevelRequirements, 
  validateSellerLevelRequirements,
  shouldDemoteSellerLevel,
  SellerStats 
} from '@/lib/seller-level-enforcement';

interface UseSellerLevelProps {
  userId?: string;
}

export function useSellerLevel({ userId }: UseSellerLevelProps = {}) {
  const { user } = useAuth();
  const [sellerLevelData, setSellerLevelData] = useState<SellerLevelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.uid;

  const calculateSellerStats = useCallback(async (uid: string) => {
    try {
      const { db } = await getFirebaseServices();
      if (!db) throw new Error('Database not initialized');

      // Get user data for account age
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      // Resolve join date from multiple possible fields and types (Firestore Timestamp | ISO string | number)
      let joinDateVal: any = userData.joinDate ?? userData.createdAt ?? userData.created_at ?? null;
      let joinDate: Date;

      try {
        if (joinDateVal && typeof joinDateVal === 'object' && typeof joinDateVal.toDate === 'function') {
          joinDate = joinDateVal.toDate();
        } else if (typeof joinDateVal === 'string') {
          // ISO string from screenshot example "2025-01-29T23:21:25.575Z"
          joinDate = new Date(joinDateVal);
        } else if (typeof joinDateVal === 'number') {
          joinDate = new Date(joinDateVal);
        } else {
          // Fallback to current date if not available
          joinDate = new Date();
        }
      } catch {
        joinDate = new Date();
      }

      // Days since join, never negative
      const millis = Date.now() - joinDate.getTime();
      const accountAge = Math.max(0, Math.floor(millis / (1000 * 60 * 60 * 24)));

      // Get completed sales count from orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('sellerId', '==', uid),
        where('status', '==', 'completed')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const completedSales = ordersSnapshot.docs.length;

      // Get review stats
      let rating: number | null = null;
      let reviewCount = 0;
      
      try {
        const reviewStatsDoc = await getDoc(doc(db, 'reviewStats', uid));
        if (reviewStatsDoc.exists()) {
          const statsData = reviewStatsDoc.data();
          rating = statsData.averageRating || null;
          reviewCount = statsData.totalReviews || 0;
        }
      } catch (reviewError) {
        console.warn('Could not fetch review stats:', reviewError);
      }

      // Calculate chargeback rate (placeholder - would need actual chargeback data)
      // For now, assume 0% chargeback rate for all users
      const chargebackRate = 0;

      // Count unresolved disputes (placeholder - would need actual dispute system)
      // For now, assume 0 unresolved disputes
      const unresolvedDisputes = 0;

      return {
        completedSales,
        chargebackRate,
        rating,
        reviewCount,
        accountAge,
        unresolvedDisputes,
        joinDate
      };
    } catch (error) {
      console.error('Error calculating seller stats:', error);
      throw error;
    }
  }, []);

  const fetchSellerLevel = useCallback(async (uid: string, forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedData = sellerLevelCache.get(uid);
        if (cachedData) {
          setSellerLevelData(cachedData);
          setIsLoading(false);
          return cachedData;
        }
      }

      const { db } = await getFirebaseServices();
      if (!db) throw new Error('Database not initialized');

      // Calculate current stats
      const stats = await calculateSellerStats(uid);

      // Get existing seller level data from Firestore
      let existingLevelData = null;
      let manuallySet = false;
      let storedLevel = 1;

      try {
        const sellerLevelDoc = await getDoc(doc(db, 'sellerLevels', uid));
        if (sellerLevelDoc.exists()) {
          existingLevelData = sellerLevelDoc.data();
          storedLevel = existingLevelData.level || 1;
          manuallySet = existingLevelData.manuallySet || false;
        }
      } catch (error) {
        console.warn('Could not fetch existing seller level:', error);
      }

      // Enforce seller level requirements
      const enforcedLevel = enforceSellerLevelRequirements(storedLevel, stats, manuallySet);
      
      // Check if user should be demoted
      const demotionCheck = shouldDemoteSellerLevel(storedLevel, stats, manuallySet);
      
      // Use the enforced level
      const currentLevel = enforcedLevel;
      const config = SELLER_LEVEL_CONFIG[currentLevel];

      // Check if can advance to next level (only for levels 1-3, 4-5 require manual approval)
      const canAdvance = canAdvanceToNextLevel(currentLevel, stats);
      const nextLevelRequirements = getNextLevelRequirements(currentLevel);

      const levelData: SellerLevelData = {
        level: currentLevel,
        completedSales: stats.completedSales,
        chargebackRate: stats.chargebackRate,
        rating: stats.rating,
        reviewCount: stats.reviewCount,
        accountAge: stats.accountAge,
        unresolvedDisputes: stats.unresolvedDisputes,
        lastLevelCheck: new Date(),
        canAdvance,
        nextLevelRequirements,
        currentLimits: config.limits
      };

      // Cache the data
      sellerLevelCache.set(uid, levelData);

      // Save/update seller level data in Firestore
      try {
        const updateData = {
          ...levelData,
          lastLevelCheck: new Date(),
          updatedAt: new Date(),
          // Preserve manual settings if they exist
          manuallySet: existingLevelData?.manuallySet || false,
          manuallySetBy: existingLevelData?.manuallySetBy || null,
          manuallySetReason: existingLevelData?.manuallySetReason || null
        };

        // If level was demoted, log the demotion
        if (demotionCheck.shouldDemote) {
          updateData.lastDemotion = {
            previousLevel: storedLevel,
            newLevel: currentLevel,
            reason: demotionCheck.reason,
            demotedAt: new Date(),
            automatic: true
          };
        }

        await setDoc(doc(db, 'sellerLevels', uid), updateData, { merge: true });

        // Log level changes
        if (storedLevel !== currentLevel) {
          await setDoc(doc(db, 'sellerLevelHistory', `${uid}_${Date.now()}`), {
            userId: uid,
            previousLevel: storedLevel,
            newLevel: currentLevel,
            reason: demotionCheck.shouldDemote ? demotionCheck.reason : 'Automatic level calculation',
            changedBy: 'system',
            timestamp: new Date(),
            automatic: true,
            statsAtTime: stats
          });
        }
      } catch (writeError) {
        console.warn('Could not save seller level data to Firestore:', writeError);
        // Continue without failing - we can still show the calculated data
      }

      setSellerLevelData(levelData);
      return levelData;
    } catch (err: any) {
      console.error('Error fetching seller level:', err);
      setError(err.message || 'Failed to fetch seller level');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [calculateSellerStats]);

  const refreshSellerLevel = useCallback(async (forceRefresh = true) => {
    if (!targetUserId) return null;
    return await fetchSellerLevel(targetUserId, forceRefresh);
  }, [targetUserId, fetchSellerLevel]);

  const invalidateCache = useCallback(() => {
    if (targetUserId) {
      sellerLevelCache.delete(targetUserId);
    }
  }, [targetUserId]);

  const checkListingLimits = useCallback((price: number, totalActiveValue?: number) => {
    if (!sellerLevelData) return { allowed: false, reason: 'Seller level not loaded' };

    const limits = sellerLevelData.currentLimits;

    // Check total listing value limit if provided and not unlimited
    if (limits.maxTotalListingValue !== null && totalActiveValue !== undefined) {
      if ((totalActiveValue + price) > limits.maxTotalListingValue) {
        return {
          allowed: false,
          reason: `Adding this item would exceed your level ${sellerLevelData.level} total listing limit of $${limits.maxTotalListingValue.toLocaleString()}`
        };
      }
    }

    // Check max active listings limit if it exists
    if (limits.maxActiveListings !== undefined) {
      // This would need to be checked with actual listing count, but for now we'll allow it
      // The actual check should be done when creating listings with the current active count
    }

    return { allowed: true };
  }, [sellerLevelData]);

  const getTotalActiveListingValue = useCallback(async (uid: string) => {
    try {
      const { db } = await getFirebaseServices();
      if (!db) return 0;

      const listingsQuery = query(
        collection(db, 'listings'),
        where('userId', '==', uid),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(listingsQuery);
      let totalValue = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalValue += Number(data.price) || 0;
      });

      return totalValue;
    } catch (error) {
      console.error('Error calculating total active listing value:', error);
      return 0;
    }
  }, []);

  useEffect(() => {
    if (!targetUserId) {
      setIsLoading(false);
      setSellerLevelData(null);
      return;
    }

    // Check if we have cached data first to avoid unnecessary loading state
    const cachedData = sellerLevelCache.get(targetUserId);
    if (cachedData) {
      setSellerLevelData(cachedData);
      setIsLoading(false);
      setError(null);
    } else {
      fetchSellerLevel(targetUserId);
    }
  }, [targetUserId, fetchSellerLevel]);

  return {
    sellerLevelData,
    isLoading,
    error,
    refreshSellerLevel,
    invalidateCache,
    checkListingLimits,
    getTotalActiveListingValue,
    config: sellerLevelData ? SELLER_LEVEL_CONFIG[sellerLevelData.level] : null
  };
}