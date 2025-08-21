import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

type MetricsResponse = {
  success: true;
  generatedAt: string;
  windowDays: number;
  scanned: number;
  totals: {
    completedSinceWindow: number;
    within90Days: number;
    reviewSubmitted: number;
    pendingReview: number;
    excludedForIssues: number;
  };
  sent: {
    d3: number;
    d10: number;
    d30: number;
  };
  eligible: {
    d3: number;
    d10: number;
    d30: number;
  };
};

function toJsDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  return null;
}

function getCompletionDate(order: any): Date | null {
  return (
    toJsDate(order.buyerCompletedAt) ||
    toJsDate(order.autoCompletedAt) ||
    toJsDate(order.pickupCompletedAt) ||
    toJsDate(order.updatedAt) ||
    toJsDate(order.createdAt)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple admin auth using ADMIN_SECRET
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
  const headerSecret = (req.headers['x-admin-secret'] as string) || '';
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  if (!ADMIN_SECRET || (!bearer && !headerSecret) || (bearer !== ADMIN_SECRET && headerSecret !== ADMIN_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { db } = getFirebaseAdmin();
    const now = new Date();
    const WINDOW_DAYS = 120; // analyze last 120 days for metrics
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const sinceTs = Timestamp.fromDate(since);

    // Query completed orders in window
    // Note: Firestore composite indexes may be required depending on data volume
    const snap = await db
      .collection('orders')
      .where('status', '==', 'completed')
      .where('updatedAt', '>=', sinceTs)
      .limit(2000)
      .get();

    let scanned = 0;
    let completedSinceWindow = 0;
    let within90Days = 0;
    let reviewSubmitted = 0;
    let pendingReview = 0;
    let excludedForIssues = 0;

    const sent = { d3: 0, d10: 0, d30: 0 };
    const eligible = { d3: 0, d10: 0, d30: 0 };

    for (const doc of snap.docs) {
      scanned += 1;
      const o: any = doc.data();

      completedSinceWindow += 1;

      if (o.reviewSubmitted) {
        reviewSubmitted += 1;
      }

      // Determine completion date and days since completion
      const completedAt = getCompletionDate(o);
      if (!completedAt) {
        continue;
      }

      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSince = Math.floor((now.getTime() - completedAt.getTime()) / msPerDay);
      if (daysSince <= 90) {
        within90Days += 1;
      }

      // Pending review = completed, within 90 days, and not yet reviewed
      if (!o.reviewSubmitted && daysSince <= 90) {
        // Exclude if issues present
        const hasIssue =
          o.hasDispute === true ||
          (typeof o.refundStatus === 'string' &&
            ['requested', 'processing', 'completed'].includes(o.refundStatus));
        if (hasIssue) {
          excludedForIssues += 1;
        } else {
          pendingReview += 1;

          // Track sent reminder flags
          if (o.remindersSent?.d3) sent.d3 += 1;
          if (o.remindersSent?.d10) sent.d10 += 1;
          if (o.remindersSent?.d30) sent.d30 += 1;

          // Track current eligibility (not yet sent) by day thresholds
          if (daysSince >= 3 && !o.remindersSent?.d3) eligible.d3 += 1;
          if (daysSince >= 10 && !o.remindersSent?.d10) eligible.d10 += 1;
          if (daysSince >= 30 && !o.remindersSent?.d30) eligible.d30 += 1;
        }
      }
    }

    const payload: MetricsResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      windowDays: WINDOW_DAYS,
      scanned,
      totals: {
        completedSinceWindow,
        within90Days,
        reviewSubmitted,
        pendingReview,
        excludedForIssues,
      },
      sent,
      eligible,
    };

    return res.status(200).json(payload);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[admin/reviews/metrics] Error:', err);
    return res.status(500).json({ error: 'Failed to compute metrics', details: err?.message || String(err) });
  }
}