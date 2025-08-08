import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';
import { 
  SellerLevel, 
  SellerLevelData, 
  SELLER_LEVEL_CONFIG, 
  calculateSellerLevel, 
  canAdvanceToNextLevel, 
  getNextLevelRequirements 
} from '@/types/seller-level';

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
      const joinDate = userData.createdAt?.toDate() || new Date();
      const accountAge = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

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

  const fetchSellerLevel = useCallback(async (uid: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { db } = await getFirebaseServices();
      if (!db) throw new Error('Database not initialized');

      // Calculate current stats
      const stats = await calculateSellerStats(uid);

      // Calculate current level based on stats
      const currentLevel = calculateSellerLevel(stats);
      const config = SELLER_LEVEL_CONFIG[currentLevel];

      // Check if can advance to next level
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

      // Save/update seller level data in Firestore
      await setDoc(doc(db, 'sellerLevels', uid), {
        ...levelData,
        lastLevelCheck: new Date(),
        updatedAt: new Date()
      }, { merge: true });

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

  const refreshSellerLevel = useCallback(async () => {
    if (!targetUserId) return null;
    return await fetchSellerLevel(targetUserId);
  }, [targetUserId, fetchSellerLevel]);

  const checkListingLimits = useCallback((price: number, totalActiveValue?: number) => {
    if (!sellerLevelData) return { allowed: false, reason: 'Seller level not loaded' };

    const limits = sellerLevelData.currentLimits;

    // Check individual item limit
    if (price > limits.maxIndividualItemValue) {
      return {
        allowed: false,
        reason: `Item price ($${price}) exceeds your level ${sellerLevelData.level} limit of $${limits.maxIndividualItemValue} per item`
      };
    }

    // Check total listing value limit if provided
    if (totalActiveValue !== undefined && (totalActiveValue + price) > limits.maxTotalListingValue) {
      return {
        allowed: false,
        reason: `Adding this item would exceed your level ${sellerLevelData.level} total listing limit of $${limits.maxTotalListingValue}`
      };
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

    fetchSellerLevel(targetUserId);
  }, [targetUserId, fetchSellerLevel]);

  return {
    sellerLevelData,
    isLoading,
    error,
    refreshSellerLevel,
    checkListingLimits,
    getTotalActiveListingValue,
    config: sellerLevelData ? SELLER_LEVEL_CONFIG[sellerLevelData.level] : null
  };
}