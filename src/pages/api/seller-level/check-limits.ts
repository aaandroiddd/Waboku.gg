import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { calculateSellerLevel, SELLER_LEVEL_CONFIG } from '@/types/seller-level';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { price, userId } = req.body;

    if (!price || !userId) {
      return res.status(400).json({ error: 'Price and userId are required' });
    }

    const { db } = getFirebaseAdmin();
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Get user data for account age
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const joinDate = userData?.createdAt?.toDate() || new Date();
    const accountAge = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get completed sales count from orders
    const ordersSnapshot = await db
      .collection('orders')
      .where('sellerId', '==', userId)
      .where('status', '==', 'completed')
      .get();
    const completedSales = ordersSnapshot.docs.length;

    // Get review stats
    let rating: number | null = null;
    let reviewCount = 0;
    
    try {
      const reviewStatsDoc = await db.collection('reviewStats').doc(userId).get();
      if (reviewStatsDoc.exists) {
        const statsData = reviewStatsDoc.data();
        rating = statsData?.averageRating || null;
        reviewCount = statsData?.totalReviews || 0;
      }
    } catch (reviewError) {
      console.warn('Could not fetch review stats:', reviewError);
    }

    // Calculate chargeback rate (placeholder - would need actual chargeback data)
    const chargebackRate = 0;

    // Count unresolved disputes (placeholder - would need actual dispute system)
    const unresolvedDisputes = 0;

    // Calculate current seller level
    const currentLevel = calculateSellerLevel({
      completedSales,
      chargebackRate,
      rating,
      reviewCount,
      accountAge,
      unresolvedDisputes
    });

    const config = SELLER_LEVEL_CONFIG[currentLevel];
    const limits = config.limits;

    // Get current active listings
    const activeListingsSnapshot = await db
      .collection('listings')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();
    
    // Get current archived listings (these can be restored)
    const archivedListingsSnapshot = await db
      .collection('listings')
      .where('userId', '==', userId)
      .where('status', '==', 'archived')
      .get();
    
    let totalActiveValue = 0;
    activeListingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalActiveValue += Number(data.price) || 0;
    });

    const activeListingCount = activeListingsSnapshot.docs.length;
    const archivedListingCount = archivedListingsSnapshot.docs.length;
    const totalListingCount = activeListingCount + archivedListingCount;

    // Check individual item limit
    if (price > limits.maxIndividualItemValue) {
      return res.status(400).json({
        allowed: false,
        reason: `Item price ($${price}) exceeds your level ${currentLevel} limit of $${limits.maxIndividualItemValue} per item`,
        currentLevel,
        limits
      });
    }

    // Check total listing value limit
    if ((totalActiveValue + price) > limits.maxTotalListingValue) {
      return res.status(400).json({
        allowed: false,
        reason: `Adding this item would exceed your level ${currentLevel} total listing limit of $${limits.maxTotalListingValue}`,
        currentLevel,
        limits
      });
    }

    // Check active + archived listing count limit (if applicable)
    // This prevents users from bypassing limits by archiving and restoring listings
    if (limits.maxActiveListings && totalListingCount >= limits.maxActiveListings) {
      return res.status(400).json({
        allowed: false,
        reason: `You have reached your level ${currentLevel} listing limit of ${limits.maxActiveListings} listings (${activeListingCount} active, ${archivedListingCount} archived). Archived listings count toward your limit since they can be restored. Please permanently delete some listings to create new ones.`,
        currentLevel,
        limits
      });
    }

    return res.status(200).json({
      allowed: true,
      currentLevel,
      limits,
      currentStats: {
        totalActiveValue,
        activeListingCount,
        archivedListingCount,
        totalListingCount,
        completedSales,
        rating,
        reviewCount,
        accountAge
      }
    });

  } catch (error) {
    console.error('Error checking seller level limits:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}