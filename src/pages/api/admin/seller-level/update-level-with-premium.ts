import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, setDoc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { SellerLevel, SELLER_LEVEL_CONFIG } from '@/types/seller-level';
import { sellerLevelCache } from '@/lib/seller-level-cache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, newLevel, reason, grantPremium, moderatorAction } = req.body;

    if (!userId || !newLevel || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (![1, 2, 3, 4, 5].includes(newLevel)) {
      return res.status(400).json({ error: 'Invalid seller level' });
    }

    const { db } = await getFirebaseServices();
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Verify user exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Get current seller level data
    let currentLevelData = null;
    try {
      const sellerLevelDoc = await getDoc(doc(db, 'sellerLevels', userId));
      if (sellerLevelDoc.exists()) {
        currentLevelData = sellerLevelDoc.data();
      }
    } catch (error) {
      console.warn('Could not fetch current seller level:', error);
    }

    const currentLevel = currentLevelData?.level || 1;

    // Update seller level
    const levelConfig = SELLER_LEVEL_CONFIG[newLevel as SellerLevel];
    const updatedLevelData = {
      ...currentLevelData,
      level: newLevel,
      lastLevelCheck: new Date(),
      updatedAt: new Date(),
      manuallySet: true,
      manuallySetBy: moderatorAction ? 'moderator' : 'admin',
      manuallySetReason: reason,
      currentLimits: levelConfig.limits
    };

    await setDoc(doc(db, 'sellerLevels', userId), updatedLevelData, { merge: true });

    // Handle premium account granting for Level 4 and 5
    let premiumGranted = false;
    if ((newLevel >= 4 && grantPremium) || newLevel >= 4) {
      try {
        // Check current premium status
        const accountDoc = await getDoc(doc(db, 'accounts', userId));
        const currentAccountData = accountDoc.exists() ? accountDoc.data() : {};
        
        // Grant premium benefits
        const premiumAccountData = {
          ...currentAccountData,
          tier: 'premium',
          premiumGrantedByLevel: true,
          premiumGrantedLevel: newLevel,
          premiumGrantedAt: new Date(),
          premiumGrantedBy: moderatorAction ? 'moderator' : 'admin',
          premiumGrantedReason: `Automatic premium grant for ${levelConfig.name}`,
          // Preserve existing subscription data if any
          stripeCustomerId: currentAccountData.stripeCustomerId || null,
          subscriptionId: currentAccountData.subscriptionId || null,
          subscriptionStatus: currentAccountData.subscriptionStatus || null,
          // Set premium features
          features: {
            ...currentAccountData.features,
            unlimitedListings: true,
            prioritySupport: true,
            advancedAnalytics: true,
            bulkListingTools: true,
            extendedOfferDuration: true,
            customProfileBadges: true,
            earlyFeatureAccess: true
          },
          updatedAt: new Date()
        };

        await setDoc(doc(db, 'accounts', userId), premiumAccountData, { merge: true });
        premiumGranted = true;

        // Log premium grant
        await addDoc(collection(db, 'premiumGrants'), {
          userId,
          username: userData.username || 'Unknown',
          email: userData.email || 'Unknown',
          grantedBy: moderatorAction ? 'moderator' : 'admin',
          grantedAt: new Date(),
          reason: `Level ${newLevel} seller level upgrade`,
          sellerLevel: newLevel,
          previousTier: currentAccountData.tier || 'free'
        });

      } catch (premiumError) {
        console.error('Error granting premium benefits:', premiumError);
        // Don't fail the entire operation if premium grant fails
        // The level update should still succeed
      }
    }

    // Log the level change
    await addDoc(collection(db, 'sellerLevelHistory'), {
      userId,
      username: userData.username || 'Unknown',
      email: userData.email || 'Unknown',
      previousLevel: currentLevel,
      newLevel,
      reason,
      changedBy: moderatorAction ? 'moderator' : 'admin',
      timestamp: new Date(),
      premiumGranted,
      moderatorAction: moderatorAction || false
    });

    // Clear cache for this user
    sellerLevelCache.delete(userId);

    res.status(200).json({ 
      success: true, 
      message: `Successfully updated user to ${levelConfig.name}${premiumGranted ? ' and granted premium benefits' : ''}`,
      newLevel,
      previousLevel: currentLevel,
      premiumGranted
    });
  } catch (error) {
    console.error('Error updating seller level with premium:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}