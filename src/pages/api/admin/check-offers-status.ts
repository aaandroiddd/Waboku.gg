import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getOfferTTLStatus, OFFER_TTL_CONFIG } from '@/lib/offer-ttl';

/**
 * Admin endpoint to check the current status of offers in the system
 * Provides insights into TTL implementation and existing offers
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify admin access
  const authHeader = req.headers.authorization;
  const adminSecret = req.headers['x-admin-secret'] as string;
  
  let isAuthorized = false;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      isAuthorized = true;
    }
  } else if (adminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    isAuthorized = true;
  }
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Check Offers Status] Starting offers status analysis');
    const { db } = getFirebaseAdmin();
    const now = new Date();

    // Get all offers to analyze
    const allOffersSnap = await db.collection('offers').get();
    
    const analysis = {
      totalOffers: allOffersSnap.size,
      byStatus: {} as Record<string, number>,
      ttlAnalysis: {
        withTTL: 0,
        withoutTTL: 0,
        expiredWithTTL: 0,
        expiredWithoutTTL: 0,
        shouldBeDeleted: 0
      },
      sampleOffers: [] as any[],
      recommendations: [] as string[]
    };

    const sampleOffers: any[] = [];
    let sampleCount = 0;
    const maxSamples = 10;

    for (const doc of allOffersSnap.docs) {
      const data = doc.data();
      const status = data.status || 'unknown';
      
      // Count by status
      analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;
      
      // TTL analysis
      const hasTTL = !!data[OFFER_TTL_CONFIG.ttlField];
      if (hasTTL) {
        analysis.ttlAnalysis.withTTL++;
      } else {
        analysis.ttlAnalysis.withoutTTL++;
      }
      
      // Check if expired
      if (status === 'expired') {
        if (hasTTL) {
          analysis.ttlAnalysis.expiredWithTTL++;
          
          // Check if should have been deleted by now
          const ttlStatus = getOfferTTLStatus(data);
          if (ttlStatus.isExpired) {
            analysis.ttlAnalysis.shouldBeDeleted++;
          }
        } else {
          analysis.ttlAnalysis.expiredWithoutTTL++;
          
          // Check if this is a legacy expired offer that should be deleted
          const expiredDate = data.expiredAt?.toDate ? data.expiredAt.toDate() : 
                             new Date(data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || Date.now());
          const expiredAge = now.getTime() - expiredDate.getTime();
          
          if (expiredAge > OFFER_TTL_CONFIG.expiredDuration) {
            analysis.ttlAnalysis.shouldBeDeleted++;
          }
        }
      }
      
      // Collect sample offers for detailed analysis
      if (sampleCount < maxSamples) {
        const ttlStatus = hasTTL ? getOfferTTLStatus(data) : null;
        
        sampleOffers.push({
          id: doc.id,
          status: data.status,
          createdAt: data.createdAt?.toDate?.()?.toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
          expiresAt: data.expiresAt?.toDate?.()?.toISOString(),
          expiredAt: data.expiredAt?.toDate?.()?.toISOString(),
          hasTTL,
          deleteAt: data[OFFER_TTL_CONFIG.ttlField]?.toDate?.()?.toISOString(),
          ttlStatus: ttlStatus ? {
            isExpired: ttlStatus.isExpired,
            hoursUntilDeletion: ttlStatus.hoursUntilDeletion
          } : null,
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          listingId: data.listingId,
          amount: data.amount
        });
        sampleCount++;
      }
    }

    analysis.sampleOffers = sampleOffers;

    // Generate recommendations
    if (analysis.ttlAnalysis.expiredWithoutTTL > 0) {
      analysis.recommendations.push(
        `Found ${analysis.ttlAnalysis.expiredWithoutTTL} expired offers without TTL. These are legacy offers that should be cleaned up.`
      );
    }

    if (analysis.ttlAnalysis.shouldBeDeleted > 0) {
      analysis.recommendations.push(
        `Found ${analysis.ttlAnalysis.shouldBeDeleted} offers that should have been deleted by TTL or cleanup. Consider running the cleanup cron job.`
      );
    }

    if (analysis.ttlAnalysis.withoutTTL > analysis.ttlAnalysis.withTTL) {
      analysis.recommendations.push(
        `More offers without TTL (${analysis.ttlAnalysis.withoutTTL}) than with TTL (${analysis.ttlAnalysis.withTTL}). The TTL system may need time to process existing offers.`
      );
    }

    if (analysis.byStatus.pending > 0) {
      const pendingOffers = allOffersSnap.docs.filter(doc => doc.data().status === 'pending');
      let expiredPending = 0;
      
      for (const doc of pendingOffers) {
        const data = doc.data();
        if (data.expiresAt && data.expiresAt.toDate() < now) {
          expiredPending++;
        }
      }
      
      if (expiredPending > 0) {
        analysis.recommendations.push(
          `Found ${expiredPending} pending offers that have expired but haven't been processed yet. Consider running the expire-old cron job.`
        );
      }
    }

    console.log('[Check Offers Status] Analysis completed', {
      totalOffers: analysis.totalOffers,
      ttlAnalysis: analysis.ttlAnalysis,
      recommendations: analysis.recommendations.length
    });

    return res.status(200).json({
      success: true,
      message: 'Offers status analysis completed',
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Check Offers Status] Error:', error);
    return res.status(500).json({
      error: 'Failed to analyze offers status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}