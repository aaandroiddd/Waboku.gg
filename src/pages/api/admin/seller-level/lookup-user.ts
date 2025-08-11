import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useSellerLevel } from '@/hooks/useSellerLevel';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { searchTerm } = req.body;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const { db } = await getFirebaseServices();
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Search for user by username or email
    let userDoc = null;
    let userId = '';

    // First try to find by username
    const usernameQuery = query(
      collection(db, 'users'),
      where('username', '==', searchTerm),
      limit(1)
    );
    const usernameSnapshot = await getDocs(usernameQuery);

    if (!usernameSnapshot.empty) {
      userDoc = usernameSnapshot.docs[0];
      userId = userDoc.id;
    } else {
      // Try to find by email
      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', searchTerm),
        limit(1)
      );
      const emailSnapshot = await getDocs(emailQuery);

      if (!emailSnapshot.empty) {
        userDoc = emailSnapshot.docs[0];
        userId = userDoc.id;
      }
    }

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Get seller level data
    const joinDate = userData.createdAt?.toDate() || new Date();
    const accountAge = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get completed sales count
    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', userId),
      where('status', '==', 'completed')
    );
    const ordersSnapshot = await getDocs(ordersQuery);
    const completedSales = ordersSnapshot.docs.length;

    // Get review stats
    let rating: number | null = null;
    let reviewCount = 0;
    
    try {
      const reviewStatsDoc = await getDoc(doc(db, 'reviewStats', userId));
      if (reviewStatsDoc.exists()) {
        const statsData = reviewStatsDoc.data();
        rating = statsData.averageRating || null;
        reviewCount = statsData.totalReviews || 0;
      }
    } catch (reviewError) {
      console.warn('Could not fetch review stats:', reviewError);
    }

    // Get current seller level from sellerLevels collection or calculate it
    let currentLevel = 1;
    try {
      const sellerLevelDoc = await getDoc(doc(db, 'sellerLevels', userId));
      if (sellerLevelDoc.exists()) {
        currentLevel = sellerLevelDoc.data().level || 1;
      }
    } catch (error) {
      console.warn('Could not fetch seller level:', error);
    }

    // Get account/premium status
    let isPremium = false;
    let stripeConnectStatus = null;
    let hasStripeStandard = false;
    
    try {
      const accountDoc = await getDoc(doc(db, 'accounts', userId));
      if (accountDoc.exists()) {
        const accountData = accountDoc.data();
        isPremium = accountData.tier === 'premium' || accountData.premiumGrantedByLevel === true;
        
        // Check Stripe Connect status
        if (accountData.stripeConnectAccountId) {
          stripeConnectStatus = accountData.stripeConnectStatus || 'connected';
          hasStripeStandard = accountData.stripeConnectType === 'standard';
        }
      }
    } catch (error) {
      console.warn('Could not fetch account data:', error);
    }

    // Calculate chargeback rate (placeholder - would need actual chargeback data)
    const chargebackRate = 0;

    // Count unresolved disputes (placeholder - would need actual dispute system)
    const unresolvedDisputes = 0;

    const userInfo = {
      userId,
      username: userData.username || 'Unknown',
      email: userData.email || 'Unknown',
      currentLevel,
      completedSales,
      rating,
      reviewCount,
      accountAge,
      chargebackRate,
      unresolvedDisputes,
      joinDate,
      isPremium,
      stripeConnectStatus,
      hasStripeStandard
    };

    res.status(200).json(userInfo);
  } catch (error) {
    console.error('Error looking up user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}