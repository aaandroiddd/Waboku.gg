import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, setDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { SellerLevel, SELLER_LEVEL_CONFIG } from '@/types/seller-level';
import { sellerLevelCache } from '@/lib/seller-level-cache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, newLevel, reason } = req.body;

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
      manuallySetBy: 'admin',
      manuallySetReason: reason,
      currentLimits: levelConfig.limits
    };

    await setDoc(doc(db, 'sellerLevels', userId), updatedLevelData, { merge: true });

    // Log the level change
    await addDoc(collection(db, 'sellerLevelHistory'), {
      userId,
      username: userData.username || 'Unknown',
      email: userData.email || 'Unknown',
      previousLevel: currentLevel,
      newLevel,
      reason,
      changedBy: 'admin',
      timestamp: new Date()
    });

    // Clear cache for this user
    sellerLevelCache.delete(userId);

    res.status(200).json({ 
      success: true, 
      message: `Successfully updated user to ${levelConfig.name}`,
      newLevel,
      previousLevel: currentLevel
    });
  } catch (error) {
    console.error('Error updating seller level:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}