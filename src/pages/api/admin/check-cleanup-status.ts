import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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

  console.log('[Check Cleanup Status] Checking current cleanup status', new Date().toISOString());

  try {
    const { db } = getFirebaseAdmin();
    const now = new Date();
    
    // Get all archived listings
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Check Cleanup Status] Found ${archivedSnapshot.size} archived listings`);

    // Analyze each listing
    const expiredListings = [];
    const soonToExpireListings = [];
    const recentlyArchivedListings = [];
    
    for (const doc of archivedSnapshot.docs) {
      const data = doc.data();
      if (!data) continue;

      try {
        let archivedDate: Date | null = null;
        let expiresAt: Date | null = null;
        let isExpired = false;
        let hoursUntilExpiry = 0;

        // Check archivedAt timestamp
        if (data.archivedAt) {
          archivedDate = data.archivedAt.toDate ? data.archivedAt.toDate() : new Date(data.archivedAt);
          // Archived listings should expire 7 days after being archived
          expiresAt = new Date(archivedDate.getTime() + (7 * 24 * 60 * 60 * 1000));
          isExpired = now > expiresAt;
          hoursUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        } else if (data.expiresAt) {
          // Fallback to expiresAt field
          expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          isExpired = now > expiresAt;
          hoursUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        } else {
          // No timestamps - should be considered expired
          isExpired = true;
          hoursUntilExpiry = -999;
        }

        const listingInfo = {
          listingId: doc.id,
          userId: data.userId,
          archivedAt: archivedDate?.toISOString() || 'unknown',
          expiresAt: expiresAt?.toISOString() || 'unknown',
          isExpired,
          hoursUntilExpiry,
          expirationReason: data.expirationReason || 'unknown',
          title: data.title || 'No title'
        };

        if (isExpired) {
          expiredListings.push(listingInfo);
        } else if (hoursUntilExpiry <= 24) {
          soonToExpireListings.push(listingInfo);
        }

        // Check if recently archived (within last 24 hours)
        if (archivedDate && (now.getTime() - archivedDate.getTime()) < (24 * 60 * 60 * 1000)) {
          recentlyArchivedListings.push(listingInfo);
        }
      } catch (error) {
        console.error(`[Check Cleanup Status] Error analyzing listing ${doc.id}:`, error);
      }
    }

    // Sort by expiry time
    expiredListings.sort((a, b) => a.hoursUntilExpiry - b.hoursUntilExpiry);
    soonToExpireListings.sort((a, b) => a.hoursUntilExpiry - b.hoursUntilExpiry);

    // Check when the last cron job should have run
    const lastHourlyRun = new Date(now);
    lastHourlyRun.setMinutes(0, 0, 0); // Top of current hour
    
    const last15MinRun = new Date(now);
    const minutes = last15MinRun.getMinutes();
    last15MinRun.setMinutes(Math.floor(minutes / 15) * 15, 0, 0); // Last 15-minute mark

    const summary = {
      currentTime: now.toISOString(),
      totalArchived: archivedSnapshot.size,
      expiredCount: expiredListings.length,
      soonToExpireCount: soonToExpireListings.length,
      recentlyArchivedCount: recentlyArchivedListings.length,
      lastExpectedCleanupRun: lastHourlyRun.toISOString(),
      lastExpectedArchiveRun: last15MinRun.toISOString(),
      cronJobsSchedule: {
        archiveExpired: 'Every 15 minutes',
        cleanupArchived: 'Every hour'
      },
      expiredListings: expiredListings.slice(0, 5), // Show first 5
      soonToExpireListings: soonToExpireListings.slice(0, 3),
      recentlyArchivedListings: recentlyArchivedListings.slice(0, 3),
      analysis: {
        shouldBeWorking: expiredListings.length === 0 ? 'YES - No expired listings found' : `NO - ${expiredListings.length} expired listings still exist`,
        possibleIssues: expiredListings.length > 0 ? [
          'Cron jobs may not be running',
          'Firebase Admin SDK permissions issue',
          'FAILED_PRECONDITION errors still occurring'
        ] : []
      }
    };

    console.log('[Check Cleanup Status] Analysis completed', summary);

    return res.status(200).json({
      message: expiredListings.length === 0 
        ? 'Cleanup appears to be working correctly - no expired archived listings found'
        : `Cleanup may have issues - ${expiredListings.length} expired archived listings found`,
      summary
    });
  } catch (error: any) {
    console.error('[Check Cleanup Status] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to check cleanup status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}