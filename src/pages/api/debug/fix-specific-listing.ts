import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';
import { getUserAccountTier } from '@/lib/account-tier-detection';
import { createListingArchiveUpdate, createListingRestoreUpdate, safeTTLUpdate } from '@/lib/ttl-field-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  const { listingId } = req.body;

  if (!listingId) {
    return res.status(400).json({ error: 'Listing ID is required' });
  }

  try {
    console.log(`[Fix Specific Listing] Processing listing ${listingId}`);
    
    const { db } = getFirebaseAdmin();
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const data = listingDoc.data();
    if (!data) {
      return res.status(404).json({ error: 'Listing data is empty' });
    }

    // Parse the creation date
    let createdAt: Date;
    try {
      if (data.createdAt?.toDate) {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt) {
        createdAt = new Date(data.createdAt);
      } else {
        return res.status(400).json({ error: 'No creation date found' });
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid creation date format' });
    }

    // Get the user's account tier
    const accountTierResult = await getUserAccountTier(data.userId);
    const accountTier = accountTierResult.tier;
    const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;

    // Calculate correct expiration time
    const correctExpirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
    const now = new Date();
    const hoursActive = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    const shouldBeExpired = now > correctExpirationTime;

    const analysis = {
      listingId,
      title: data.title,
      userId: data.userId,
      username: data.username,
      currentStatus: data.status,
      accountTier,
      tierDurationHours: tierDuration,
      createdAt: createdAt.toISOString(),
      correctExpirationTime: correctExpirationTime.toISOString(),
      currentTime: now.toISOString(),
      hoursActive,
      shouldBeExpired,
      currentlyArchived: data.status === 'archived',
      archivedAt: data.archivedAt?.toDate()?.toISOString() || null,
      hasDeleteAt: !!data.deleteAt,
      deleteAt: data.deleteAt?.toDate()?.toISOString() || null
    };

    console.log('[Fix Specific Listing] Analysis:', analysis);

    // Determine what action to take
    let action = 'none';
    let updateData: any = {};

    if (shouldBeExpired && data.status !== 'archived') {
      // Should be archived but isn't
      action = 'archive';
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      updateData = createListingArchiveUpdate(Timestamp.fromDate(sevenDaysFromNow), 'manual_fix');
      
      // Add additional debug fields
      updateData.originalCreatedAt = data.createdAt;
      updateData.expirationReason = 'tier_duration_exceeded';
      updateData.previousStatus = data.status;
      updateData.previousExpiresAt = data.expiresAt;
      updateData.correctExpirationTime = Timestamp.fromDate(correctExpirationTime);
      updateData.accountTierAtArchival = accountTier;
      updateData.hoursActiveAtArchival = hoursActive;
    } else if (data.status === 'archived' && !data.deleteAt) {
      // Already archived but missing TTL
      action = 'add_ttl';
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      updateData = {
        deleteAt: Timestamp.fromDate(sevenDaysFromNow),
        ttlSetAt: Timestamp.now(),
        ttlReason: 'manual_fix_missing_ttl',
        updatedAt: Timestamp.now()
      };
    } else if (data.status === 'archived' && !shouldBeExpired && accountTier === 'premium') {
      // Incorrectly archived premium user
      action = 'restore';
      const newExpirationTime = new Date(createdAt.getTime() + (ACCOUNT_TIERS.premium.listingDuration * 60 * 60 * 1000));
      
      updateData = createListingRestoreUpdate('active', Timestamp.fromDate(newExpirationTime));
      updateData.restoredReason = 'premium_user_correction';
    }

    // Apply the fix if needed
    if (action !== 'none' && Object.keys(updateData).length > 0) {
      await safeTTLUpdate(listingRef, updateData);
      console.log(`[Fix Specific Listing] Applied ${action} to listing ${listingId}`);
    }

    return res.status(200).json({
      success: true,
      analysis,
      action,
      updateData: Object.keys(updateData),
      message: action === 'none' ? 'No action needed' : `Applied ${action} to listing`
    });

  } catch (error: any) {
    console.error(`[Fix Specific Listing] Error processing listing ${listingId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process listing',
      details: error.message
    });
  }
}