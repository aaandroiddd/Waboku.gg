import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/firebase-admin';
import { ACCOUNT_TIERS } from '@/types/account';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { listingId, accountTier } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: 'Missing listingId' });
    }

    if (!accountTier || !['free', 'premium'].includes(accountTier)) {
      return res.status(400).json({ error: 'Invalid accountTier' });
    }

    const { db } = getFirebaseAdmin();
    const listingRef = db.collection('listings').doc(listingId);
    
    // Get the listing document
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();
    if (!listingData) {
      return res.status(404).json({ error: 'Listing data not found' });
    }

    // Verify ownership
    if (listingData.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to modify this listing' });
    }

    // Get the correct duration for the account tier
    const tierDuration = ACCOUNT_TIERS[accountTier as 'free' | 'premium'].listingDuration;
    
    // Calculate the correct expiration time
    let createdAt: Date;
    try {
      if (listingData.createdAt?.toDate) {
        createdAt = listingData.createdAt.toDate();
      } else if (listingData.createdAt instanceof Date) {
        createdAt = listingData.createdAt;
      } else {
        createdAt = new Date(listingData.createdAt);
      }
    } catch (e) {
      console.error('Error parsing createdAt:', e);
      createdAt = new Date(); // Fallback to current time
    }

    // Calculate the correct expiration time
    const correctExpiresAt = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));

    // Update the listing with correct expiration and account tier
    const updateData: any = {
      expiresAt: Timestamp.fromDate(correctExpiresAt),
      accountTier: accountTier,
      updatedAt: Timestamp.now()
    };

    // If the listing is archived but shouldn't be (based on correct expiration)
    const now = new Date();
    if (listingData.status === 'archived' && correctExpiresAt > now) {
      // Restore to active if it was incorrectly archived
      updateData.status = 'active';
      updateData.archivedAt = null;
      updateData.expirationReason = null;
    }

    await listingRef.update(updateData);

    console.log(`Fixed expiration for listing ${listingId}:`, {
      userId,
      accountTier,
      oldExpiresAt: listingData.expiresAt?.toDate?.()?.toISOString() || 'none',
      newExpiresAt: correctExpiresAt.toISOString(),
      tierDuration: `${tierDuration} hours`,
      wasRestored: updateData.status === 'active'
    });

    return res.status(200).json({
      success: true,
      listingId,
      accountTier,
      oldExpiresAt: listingData.expiresAt?.toDate?.()?.toISOString() || null,
      newExpiresAt: correctExpiresAt.toISOString(),
      tierDuration,
      wasRestored: updateData.status === 'active',
      message: 'Listing expiration fixed successfully'
    });

  } catch (error: any) {
    console.error('Error fixing listing expiration:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}