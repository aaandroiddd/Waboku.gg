import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

/**
 * Monitor TTL cron job health and detect issues
 * This endpoint checks for overdue listings and cron job execution problems
 */

interface CronHealthCheck {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  metrics: {
    totalExpiredListings: number;
    oldestExpiredMinutes: number | null;
    criticallyOverdueCount: number; // More than 3 hours overdue
    warningOverdueCount: number; // More than 1 hour overdue
    expectedCronInterval: number; // 2 hours in minutes
  };
  recommendations: string[];
  nextCronExpected: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const now = new Date();
    
    // Find all expired listings
    const expiredQuery = await db.collection('listings')
      .where(LISTING_TTL_CONFIG.ttlField, '<=', admin.firestore.Timestamp.fromDate(now))
      .get();

    const healthCheck: CronHealthCheck = {
      timestamp: now.toISOString(),
      status: 'healthy',
      issues: [],
      metrics: {
        totalExpiredListings: expiredQuery.size,
        oldestExpiredMinutes: null,
        criticallyOverdueCount: 0,
        warningOverdueCount: 0,
        expectedCronInterval: 120 // 2 hours
      },
      recommendations: [],
      nextCronExpected: getNextCronTime().toISOString()
    };

    if (expiredQuery.empty) {
      return res.status(200).json({
        ...healthCheck,
        message: 'No expired listings found - system healthy'
      });
    }

    // Analyze expired listings
    let oldestExpiredTime: Date | null = null;
    const expiredDetails: Array<{
      id: string;
      deleteAt: Date;
      minutesOverdue: number;
      ttlReason: string;
    }> = [];

    for (const doc of expiredQuery.docs) {
      const data = doc.data();
      const deleteAt = data[LISTING_TTL_CONFIG.ttlField];
      const deleteAtDate = deleteAt?.toDate?.() || new Date(deleteAt);
      const minutesOverdue = Math.floor((now.getTime() - deleteAtDate.getTime()) / (1000 * 60));
      
      expiredDetails.push({
        id: doc.id,
        deleteAt: deleteAtDate,
        minutesOverdue,
        ttlReason: data.ttlReason || 'unknown'
      });
      
      if (!oldestExpiredTime || deleteAtDate < oldestExpiredTime) {
        oldestExpiredTime = deleteAtDate;
      }

      // Count overdue categories
      if (minutesOverdue > 180) { // 3+ hours
        healthCheck.metrics.criticallyOverdueCount++;
      } else if (minutesOverdue > 60) { // 1+ hours
        healthCheck.metrics.warningOverdueCount++;
      }
    }

    if (oldestExpiredTime) {
      healthCheck.metrics.oldestExpiredMinutes = Math.floor(
        (now.getTime() - oldestExpiredTime.getTime()) / (1000 * 60)
      );
    }

    // Determine health status and issues
    if (healthCheck.metrics.criticallyOverdueCount > 0) {
      healthCheck.status = 'critical';
      healthCheck.issues.push(
        `${healthCheck.metrics.criticallyOverdueCount} listings are critically overdue (3+ hours)`
      );
      healthCheck.recommendations.push('Run manual TTL cleanup immediately');
      healthCheck.recommendations.push('Check Vercel cron job logs for execution failures');
    } else if (healthCheck.metrics.warningOverdueCount > 0) {
      healthCheck.status = 'warning';
      healthCheck.issues.push(
        `${healthCheck.metrics.warningOverdueCount} listings are overdue (1+ hours)`
      );
      healthCheck.recommendations.push('Monitor for next cron execution');
    }

    // Check if cron job appears to be failing
    if (healthCheck.metrics.oldestExpiredMinutes && healthCheck.metrics.oldestExpiredMinutes > 150) {
      healthCheck.issues.push('Cron job may not be executing - listings significantly overdue');
      healthCheck.recommendations.push('Verify Vercel cron job configuration');
      healthCheck.recommendations.push('Check for authentication issues in cron job');
      healthCheck.recommendations.push('Consider implementing backup monitoring');
    }

    // Add detailed information for debugging
    const response = {
      ...healthCheck,
      message: `Found ${expiredQuery.size} expired listings`,
      expiredListingsDetails: expiredDetails.slice(0, 5).map(item => ({
        id: item.id,
        deleteAt: item.deleteAt.toISOString(),
        minutesOverdue: item.minutesOverdue,
        ttlReason: item.ttlReason
      })),
      cronConfiguration: {
        schedule: '15 */2 * * * (every 2 hours at :15)',
        lastExpectedRun: getLastCronTime().toISOString(),
        nextExpectedRun: getNextCronTime().toISOString()
      }
    };

    console.log('[TTL Monitor] Health check completed', {
      status: healthCheck.status,
      totalExpired: healthCheck.metrics.totalExpiredListings,
      oldestExpiredMinutes: healthCheck.metrics.oldestExpiredMinutes,
      issues: healthCheck.issues
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('[TTL Monitor] Error during health check:', error);
    return res.status(500).json({
      error: 'Failed to check TTL cron health',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Calculate the next expected cron execution time
 */
function getNextCronTime(): Date {
  const now = new Date();
  const nextRun = new Date(now);
  
  // Cron runs at :15 minutes every 2 hours
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Find next even hour + 15 minutes
  let nextHour = currentHour;
  if (currentHour % 2 === 1) {
    nextHour = currentHour + 1; // Next even hour
  } else if (currentMinute >= 15) {
    nextHour = currentHour + 2; // Next even hour after current
  }
  
  // Handle day rollover
  if (nextHour >= 24) {
    nextRun.setDate(nextRun.getDate() + 1);
    nextHour = nextHour - 24;
  }
  
  nextRun.setHours(nextHour, 15, 0, 0);
  return nextRun;
}

/**
 * Calculate the last expected cron execution time
 */
function getLastCronTime(): Date {
  const now = new Date();
  const lastRun = new Date(now);
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Find last even hour + 15 minutes
  let lastHour = currentHour;
  if (currentHour % 2 === 1) {
    lastHour = currentHour - 1; // Previous even hour
  } else if (currentMinute < 15) {
    lastHour = currentHour - 2; // Previous even hour before current
  }
  
  // Handle day rollover
  if (lastHour < 0) {
    lastRun.setDate(lastRun.getDate() - 1);
    lastHour = lastHour + 24;
  }
  
  lastRun.setHours(lastHour, 15, 0, 0);
  return lastRun;
}