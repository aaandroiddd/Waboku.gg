import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify admin access
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - missing authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_SECRET && token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }

  console.log('[Test Cleanup Archived] Starting test cleanup process', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    
    // Get all archived listings to analyze
    const now = new Date();
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Test Cleanup Archived] Found ${archivedSnapshot.size} total archived listings`);

    // Analyze each listing
    const analysis = [];
    
    for (const doc of archivedSnapshot.docs) {
      const data = doc.data();
      if (!data) continue;

      let expiresAt: Date | null = null;
      let isExpired = false;
      let timeUntilExpiry = 0;

      try {
        if (data.expiresAt) {
          expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          isExpired = now > expiresAt;
          timeUntilExpiry = expiresAt.getTime() - now.getTime();
        } else {
          // If no expiresAt, this is problematic
          expiresAt = null;
          isExpired = true; // Should be considered expired if no expiry date
        }

        analysis.push({
          listingId: doc.id,
          userId: data.userId,
          archivedAt: data.archivedAt?.toDate?.()?.toISOString() || 'unknown',
          expiresAt: expiresAt?.toISOString() || 'missing',
          isExpired,
          timeUntilExpiryMs: timeUntilExpiry,
          timeUntilExpiryHours: Math.round(timeUntilExpiry / (1000 * 60 * 60)),
          timeUntilExpiryMinutes: Math.round(timeUntilExpiry / (1000 * 60)),
          expirationReason: data.expirationReason || 'unknown'
        });
      } catch (error) {
        console.error(`[Test Cleanup Archived] Error analyzing listing ${doc.id}:`, error);
        analysis.push({
          listingId: doc.id,
          userId: data.userId,
          error: error.message,
          archivedAt: data.archivedAt?.toDate?.()?.toISOString() || 'unknown',
          expiresAt: 'error parsing',
          isExpired: true
        });
      }
    }

    // Sort by time until expiry (expired first)
    analysis.sort((a, b) => {
      if (a.isExpired && !b.isExpired) return -1;
      if (!a.isExpired && b.isExpired) return 1;
      return (a.timeUntilExpiryMs || 0) - (b.timeUntilExpiryMs || 0);
    });

    const expiredCount = analysis.filter(item => item.isExpired).length;
    const nonExpiredCount = analysis.length - expiredCount;

    const summary = {
      totalArchived: archivedSnapshot.size,
      expiredCount,
      nonExpiredCount,
      currentTime: now.toISOString(),
      analysis: analysis.slice(0, 10), // Show first 10 for debugging
      expiredListings: analysis.filter(item => item.isExpired).slice(0, 5),
      soonToExpireListings: analysis.filter(item => !item.isExpired && item.timeUntilExpiryMs < 24 * 60 * 60 * 1000).slice(0, 5)
    };

    console.log('[Test Cleanup Archived] Analysis completed', summary);

    return res.status(200).json({
      message: `Analysis complete: ${expiredCount} expired, ${nonExpiredCount} not expired`,
      summary
    });
  } catch (error: any) {
    console.error('[Test Cleanup Archived] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to analyze archived listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}