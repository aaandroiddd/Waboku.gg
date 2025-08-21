import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { emailService } from '@/lib/email-service';
import { Order } from '@/types/order';

type Summary = {
  checked: number;
  sent: number;
  notifications: number;
  errors: number;
  breakdown: { d3?: number; d10?: number; d30?: number };
  processedOrderIds: string[];
  timestamp: string;
};

const BATCH_SIZE = 200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function chooseReminder(daysSince: number, sent?: { d3?: boolean; d10?: boolean; d30?: boolean }): 'd30' | 'd10' | 'd3' | null {
  const already = sent || {};
  if (daysSince >= 30 && !already.d30) return 'd30';
  if (daysSince >= 10 && !already.d10) return 'd10';
  if (daysSince >= 3 && !already.d3) return 'd3';
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // AuthZ: allow Vercel cron, or manual with CRON_SECRET / NEXT_PUBLIC_ADMIN_SECRET
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  let authorized = false;
  if (isVercelCron) {
    authorized = true;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
        authorized = true;
      }
    }
  }
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const summary: Summary = {
    checked: 0,
    sent: 0,
    notifications: 0,
    errors: 0,
    breakdown: {},
    processedOrderIds: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const { db } = getFirebaseAdmin();
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY);
    const threeDaysAgoTs = Timestamp.fromDate(threeDaysAgo);

    // Fetch completed orders older than 3 days (we'll compute exact thresholds per order)
    const snap = await db
      .collection('orders')
      .where('status', '==', 'completed')
      .where('updatedAt', '<=', threeDaysAgoTs)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) {
      return res.status(200).json({
        message: 'No completed orders eligible for review reminders',
        summary,
      });
    }

    for (const doc of snap.docs) {
      summary.checked += 1;
      const order = doc.data() as Order & Record<string, any>;
      const orderId = doc.id;

      try {
        // Skip orders that should not receive reminders
        if (order.reviewSubmitted) continue;
        if (order.hasDispute) continue;
        if (order.refundStatus && ['requested', 'processing', 'completed'].includes(order.refundStatus)) continue;

        const completedAt = getCompletionDate(order);
        if (!completedAt) continue;

        const daysSince = Math.floor((now.getTime() - completedAt.getTime()) / MS_PER_DAY);
        const which = chooseReminder(daysSince, order.remindersSent);
        if (!which) continue;

        // Fetch buyer info
        const buyerDoc = await db.collection('users').doc(order.buyerId).get();
        const buyer = buyerDoc.exists ? buyerDoc.data() : null;
        const buyerEmail = buyer?.email;
        const buyerName = buyer?.displayName || buyer?.username || 'Buyer';

        // Prepare listing title from snapshot or fallback
        const listingTitle =
          order.listingSnapshot?.title ||
          (await (async () => {
            try {
              if (!order.listingId) return 'Listing';
              const listingDoc = await db.collection('listings').doc(order.listingId).get();
              return listingDoc.exists ? listingDoc.data()?.title || 'Listing' : 'Listing';
            } catch {
              return 'Listing';
            }
          })());

        // Action URL takes buyer to order with review modal
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const actionUrl = `${baseUrl}/dashboard/orders/${orderId}?review=true`;

        // Create in-app notification
        try {
          const { notificationService } = await import('@/lib/notification-service');
          await notificationService.createNotification({
            userId: order.buyerId,
            type: 'review_reminder',
            title:
              which === 'd3'
                ? 'How was your purchase?'
                : which === 'd10'
                ? 'Reminder to leave a review'
                : 'Final reminder to leave a review',
            message:
              which === 'd3'
                ? `Please share feedback on "${listingTitle}" to help the community.`
                : which === 'd10'
                ? `We’d love to hear about your order "${listingTitle}".`
                : `It’s been a while—this is a gentle nudge to review "${listingTitle}".`,
            data: {
              orderId,
              actionUrl,
            },
          });
          summary.notifications += 1;
        } catch (nErr) {
          // Non-fatal
          // eslint-disable-next-line no-console
          console.error('[review-reminders] Notification error:', nErr);
        }

        // Send email if we have buyer email
        if (buyerEmail) {
          await emailService.sendEmailNotification({
            userId: order.buyerId,
            userEmail: buyerEmail,
            userName: buyerName,
            type: 'review_reminder',
            title:
              which === 'd3'
                ? 'How was your purchase? Leave a quick review'
                : which === 'd10'
                ? 'Friendly reminder: review your recent order'
                : 'Last reminder: share your experience',
            message:
              which === 'd3'
                ? `Thanks for your purchase of "${listingTitle}". Your review helps other buyers.`
                : which === 'd10'
                ? `Could you take a moment to review "${listingTitle}"? It really helps.`
                : `This is a gentle final reminder to leave a review for "${listingTitle}".`,
            actionUrl,
            data: {
              orderId,
              listingId: order.listingId,
            },
          });
        }

        // Mark reminder as sent on order (idempotency)
        const remindersUpdate: any = {};
        remindersUpdate[`remindersSent.${which}`] = true;
        remindersUpdate.updatedAt = new Date();

        await doc.ref.update(remindersUpdate);

        summary.sent += 1;
        summary.breakdown[which] = (summary.breakdown[which] || 0) + 1;
        summary.processedOrderIds.push(orderId);
      } catch (perOrderErr) {
        summary.errors += 1;
        // eslint-disable-next-line no-console
        console.error('[review-reminders] Error processing order', { orderId, error: perOrderErr });
      }
    }

    return res.status(200).json({
      message: `Review reminders processed. Emails sent: ${summary.sent}, notifications: ${summary.notifications}`,
      summary,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[review-reminders] Fatal error:', err);
    return res.status(500).json({
      error: 'Failed to process review reminders',
      details: err?.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}