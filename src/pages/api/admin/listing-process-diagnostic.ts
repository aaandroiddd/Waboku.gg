import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { ACCOUNT_TIERS } from '@/types/account';
import { getUserAccountTier } from '@/lib/account-tier-detection';
import { LISTING_TTL_CONFIG } from '@/lib/listing-ttl';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify admin access
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Listing Diagnostic] Starting comprehensive listing process diagnostic');

  try {
    const { db } = getFirebaseAdmin();
    const now = new Date();
    
    // 1. Get overall listing statistics
    const allListingsSnapshot = await db.collection('listings').get();
    const listings = allListingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const statusCounts = {
      active: 0,
      archived: 0,
      inactive: 0,
      sold: 0,
      other: 0
    };
    
    const tierCounts = {
      free: 0,
      premium: 0,
      unknown: 0
    };
    
    const ttlStats = {
      withTTL: 0,
      withoutTTL: 0,
      expiredTTL: 0,
      validTTL: 0
    };
    
    const expirationIssues = [];
    const ttlIssues = [];
    const visibilityIssues = [];
    
    // 2. Analyze each listing
    for (const listing of listings) {
      // Count by status
      if (statusCounts.hasOwnProperty(listing.status)) {
        statusCounts[listing.status]++;
      } else {
        statusCounts.other++;
      }
      
      // Get user account tier
      let accountTier = 'unknown';
      if (listing.userId) {
        try {
          const tierResult = await getUserAccountTier(listing.userId);
          accountTier = tierResult.tier;
          tierCounts[accountTier]++;
        } catch (error) {
          tierCounts.unknown++;
        }
      } else {
        tierCounts.unknown++;
      }
      
      // Check TTL status
      const hasDeleteAt = !!listing[LISTING_TTL_CONFIG.ttlField];
      if (hasDeleteAt) {
        ttlStats.withTTL++;
        const deleteAt = listing[LISTING_TTL_CONFIG.ttlField].toDate();
        if (now > deleteAt) {
          ttlStats.expiredTTL++;
          ttlIssues.push({
            id: listing.id,
            issue: 'TTL expired but listing still exists',
            deleteAt: deleteAt.toISOString(),
            status: listing.status,
            accountTier
          });
        } else {
          ttlStats.validTTL++;
        }
      } else {
        ttlStats.withoutTTL++;
        if (listing.status === 'archived') {
          ttlIssues.push({
            id: listing.id,
            issue: 'Archived listing missing TTL field',
            status: listing.status,
            accountTier
          });
        }
      }
      
      // Check expiration logic
      if (listing.status === 'active' && listing.createdAt && listing.userId) {
        try {
          const createdAt = listing.createdAt.toDate();
          const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
          const shouldExpireAt = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
          
          if (now > shouldExpireAt) {
            expirationIssues.push({
              id: listing.id,
              issue: 'Active listing should be expired',
              createdAt: createdAt.toISOString(),
              shouldExpireAt: shouldExpireAt.toISOString(),
              accountTier,
              hoursOverdue: Math.round((now.getTime() - shouldExpireAt.getTime()) / (1000 * 60 * 60))
            });
          }
        } catch (error) {
          expirationIssues.push({
            id: listing.id,
            issue: 'Error calculating expiration',
            error: error.message,
            accountTier
          });
        }
      }
      
      // Check visibility issues (archived listings showing publicly)
      if (listing.status === 'archived') {
        // This would need to be checked against actual public queries
        // For now, we'll flag archived listings without proper TTL
        if (!hasDeleteAt) {
          visibilityIssues.push({
            id: listing.id,
            issue: 'Archived listing without TTL may be visible publicly',
            archivedAt: listing.archivedAt?.toDate()?.toISOString(),
            accountTier
          });
        }
      }
    }
    
    // 3. Check cron job status (last run times)
    const cronStatus = {
      archiveExpired: 'Unknown - check Vercel cron logs',
      ttlCleanup: 'Unknown - check Vercel cron logs',
      relatedDataCleanup: 'Unknown - check Vercel cron logs'
    };
    
    // 4. Check Firestore TTL policy status
    const ttlPolicyStatus = {
      configured: 'Unknown - requires Firestore console check',
      field: LISTING_TTL_CONFIG.ttlField,
      note: 'TTL policies are configured in Firestore console, not via API'
    };
    
    // 5. Performance metrics
    const performanceMetrics = {
      totalListings: listings.length,
      avgProcessingTime: 'N/A - would need performance monitoring',
      databaseOperations: 'N/A - would need query analysis'
    };
    
    const diagnostic = {
      timestamp: now.toISOString(),
      summary: {
        totalListings: listings.length,
        statusDistribution: statusCounts,
        tierDistribution: tierCounts,
        ttlStatistics: ttlStats,
        issuesFound: {
          expiration: expirationIssues.length,
          ttl: ttlIssues.length,
          visibility: visibilityIssues.length
        }
      },
      issues: {
        expiration: expirationIssues.slice(0, 10), // Limit to first 10
        ttl: ttlIssues.slice(0, 10),
        visibility: visibilityIssues.slice(0, 10)
      },
      systemStatus: {
        cronJobs: cronStatus,
        ttlPolicy: ttlPolicyStatus,
        performance: performanceMetrics
      },
      recommendations: []
    };
    
    // Generate recommendations
    if (expirationIssues.length > 0) {
      diagnostic.recommendations.push({
        priority: 'HIGH',
        issue: `${expirationIssues.length} active listings should be expired`,
        action: 'Run manual archive-expired cron job',
        endpoint: '/api/listings/archive-expired'
      });
    }
    
    if (ttlIssues.length > 0) {
      diagnostic.recommendations.push({
        priority: 'MEDIUM',
        issue: `${ttlIssues.length} listings have TTL issues`,
        action: 'Run TTL field validator and cleanup',
        endpoint: '/api/admin/validate-ttl-fields'
      });
    }
    
    if (visibilityIssues.length > 0) {
      diagnostic.recommendations.push({
        priority: 'MEDIUM',
        issue: `${visibilityIssues.length} archived listings may be visible publicly`,
        action: 'Run archived listings visibility fix',
        endpoint: '/api/debug/fix-archived-listings-visibility'
      });
    }
    
    if (ttlStats.expiredTTL > 0) {
      diagnostic.recommendations.push({
        priority: 'HIGH',
        issue: `${ttlStats.expiredTTL} listings have expired TTL but still exist`,
        action: 'Run manual TTL cleanup',
        endpoint: '/api/cron/cleanup-ttl-listings'
      });
    }
    
    console.log('[Listing Diagnostic] Diagnostic completed', {
      totalListings: listings.length,
      issuesFound: diagnostic.summary.issuesFound,
      recommendations: diagnostic.recommendations.length
    });
    
    return res.status(200).json({
      success: true,
      diagnostic
    });
    
  } catch (error: any) {
    console.error('[Listing Diagnostic] Error during diagnostic:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}