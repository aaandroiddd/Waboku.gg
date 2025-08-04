import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';
import { Timestamp } from 'firebase-admin/firestore';
import { Order } from '@/types/order';

// Maximum number of operations in a single batch
const BATCH_SIZE = 100;

// Reminder intervals in hours
const REMINDER_INTERVALS = [48, 72, 96]; // 48h, 72h, 96h (4 days)

// Helper function to log errors with context
const logError = (context: string, error: any, additionalInfo?: any) => {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo
  });
};

// Helper function to format shipping address
const formatShippingAddress = (address: any): string => {
  if (!address) return 'Address not provided';
  
  const parts = [
    address.name,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country
  ].filter(Boolean);
  
  return parts.join('\n');
};

// Helper function to calculate hours overdue
const calculateHoursOverdue = (createdAt: Date): number => {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  return Math.max(0, diffHours - 48); // Only count hours after the 48-hour threshold
};

// Helper function to determine which reminder interval this order qualifies for
const getQualifyingReminderInterval = (createdAt: Date, existingReminders: any[]): number | null => {
  const now = new Date();
  const orderAgeHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  
  // Find the highest interval this order qualifies for that hasn't been sent yet
  for (let i = REMINDER_INTERVALS.length - 1; i >= 0; i--) {
    const interval = REMINDER_INTERVALS[i];
    if (orderAgeHours >= interval) {
      // Check if we've already sent a reminder for this interval
      const hasReminderForInterval = existingReminders.some(reminder => 
        reminder.reminderInterval === interval
      );
      if (!hasReminderForInterval) {
        return interval;
      }
    }
  }
  
  return null;
};

// Helper function to create in-app notification
const createShippingNotification = async (db: any, orderData: Order, orderId: string, hoursOverdue: number) => {
  try {
    const notificationData = {
      userId: orderData.sellerId,
      type: 'shipping_reminder',
      title: 'Shipping Reminder',
      message: `Order #${orderId.substring(0, 8).toUpperCase()} is ${hoursOverdue} hours overdue for shipping`,
      data: {
        orderId,
        orderAmount: orderData.amount,
        hoursOverdue
      },
      read: false,
      createdAt: Timestamp.now()
    };

    await db.collection('notifications').add(notificationData);
    console.log(`[Shipping Reminders] Created in-app notification for order ${orderId}`);
  } catch (error) {
    console.error(`[Shipping Reminders] Failed to create notification for order ${orderId}:`, error);
  }
};

/**
 * Enhanced cron job to send shipping reminder emails to sellers
 * Runs every 6 hours to check for orders that need shipping reminders
 * Sends reminders at 48h, 72h, and 96h intervals
 * Creates in-app notifications alongside email reminders
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify that this is a cron job request from Vercel or an admin request
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  
  let isAuthorized = false;
  let requestType = 'unknown';
  
  if (isVercelCron) {
    isAuthorized = true;
    requestType = 'vercel-cron';
    console.log('[Shipping Reminders] Vercel cron job detected');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === process.env.CRON_SECRET || token === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      isAuthorized = true;
      requestType = token === process.env.CRON_SECRET ? 'manual-cron' : 'admin-dashboard';
    }
  }
  
  if (!isAuthorized) {
    console.warn('[Shipping Reminders] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log(`[Shipping Reminders] Request authorized as ${requestType}`);

  try {
    console.log('[Shipping Reminders] Starting enhanced shipping reminder process');
    const { db } = getFirebaseAdmin();
    const now = new Date();
    
    // Find orders that are at least 48 hours old and need shipping reminders
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    const fortyEightHoursAgoTimestamp = Timestamp.fromDate(fortyEightHoursAgo);
    
    let totalReminders = 0;
    let totalNotifications = 0;
    let totalErrors = 0;
    const processedOrders: string[] = [];
    const reminderBreakdown: { [key: number]: number } = {};

    console.log('[Shipping Reminders] Checking for orders needing shipping reminders...');
    console.log(`[Shipping Reminders] Looking for orders created before: ${fortyEightHoursAgo.toISOString()}`);
    
    // Query for orders that need shipping reminders
    // We'll check multiple statuses to catch all unshipped orders
    const statusesToCheck = ['paid', 'awaiting_shipping'];
    let allOrdersToProcess: any[] = [];

    for (const status of statusesToCheck) {
      const ordersQuery = db.collection('orders')
        .where('status', '==', status)
        .where('createdAt', '<', fortyEightHoursAgoTimestamp)
        .limit(BATCH_SIZE);

      const ordersSnapshot = await ordersQuery.get();
      allOrdersToProcess = allOrdersToProcess.concat(ordersSnapshot.docs);
    }

    // Remove duplicates and filter out pickup orders
    const uniqueOrders = allOrdersToProcess.filter((doc, index, self) => 
      index === self.findIndex(d => d.id === doc.id)
    );

    const eligibleOrders = uniqueOrders.filter(doc => {
      const data = doc.data();
      return !data.isPickup && !data.trackingInfo && data.status !== 'shipped';
    });

    if (eligibleOrders.length === 0) {
      console.log('[Shipping Reminders] No orders found needing shipping reminders');
      return res.status(200).json({
        message: 'No orders found needing shipping reminders',
        summary: {
          totalReminders: 0,
          totalNotifications: 0,
          totalErrors: 0,
          processedOrders: [],
          reminderBreakdown: {},
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`[Shipping Reminders] Found ${eligibleOrders.length} orders that may need shipping reminders`);

    // Process each order
    for (const orderDoc of eligibleOrders) {
      try {
        const orderData = orderDoc.data() as Order;
        const orderId = orderDoc.id;

        // Double-check that order still needs shipping
        if (orderData.status === 'shipped' || orderData.trackingInfo) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - already shipped or has tracking`);
          continue;
        }

        // Get existing reminders for this order
        const existingRemindersQuery = await db.collection('shippingReminders')
          .where('orderId', '==', orderId)
          .get();

        const existingReminders = existingRemindersQuery.docs.map(doc => doc.data());

        // Determine if this order qualifies for a new reminder
        const createdAt = orderData.createdAt instanceof Timestamp ? orderData.createdAt.toDate() : new Date(orderData.createdAt);
        const qualifyingInterval = getQualifyingReminderInterval(createdAt, existingReminders);

        if (!qualifyingInterval) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - no qualifying reminder interval`);
          continue;
        }

        // Check if we've sent any reminder in the last 6 hours to avoid spam
        const recentReminderCheck = existingReminders.some(reminder => {
          const sentAt = reminder.sentAt instanceof Timestamp ? reminder.sentAt.toDate() : new Date(reminder.sentAt);
          const hoursSinceLast = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
          return hoursSinceLast < 6;
        });

        if (recentReminderCheck) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - reminder sent within last 6 hours`);
          continue;
        }

        // Get seller information
        const sellerDoc = await db.collection('users').doc(orderData.sellerId).get();
        if (!sellerDoc.exists) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - seller not found`);
          continue;
        }

        const sellerData = sellerDoc.data();
        if (!sellerData?.email) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - seller email not found`);
          continue;
        }

        // Get buyer information for the reminder
        const buyerDoc = await db.collection('users').doc(orderData.buyerId).get();
        const buyerData = buyerDoc.exists ? buyerDoc.data() : null;
        const buyerName = buyerData?.displayName || buyerData?.username || 'Unknown Buyer';

        // Get listing information
        let listingTitle = 'Unknown Item';
        if (orderData.listingSnapshot?.title) {
          listingTitle = orderData.listingSnapshot.title;
        } else if (orderData.listingId) {
          try {
            const listingDoc = await db.collection('listings').doc(orderData.listingId).get();
            if (listingDoc.exists) {
              listingTitle = listingDoc.data()?.title || 'Unknown Item';
            }
          } catch (listingError) {
            console.warn(`[Shipping Reminders] Could not fetch listing ${orderData.listingId}:`, listingError);
          }
        }

        // Calculate hours overdue
        const hoursOverdue = calculateHoursOverdue(createdAt);

        // Format order number (use order ID if no specific order number format)
        const orderNumber = orderId.substring(0, 8).toUpperCase();

        // Prepare shipping reminder email data
        const reminderData = {
          userName: sellerData.displayName || sellerData.username || 'Seller',
          userEmail: sellerData.email,
          orderNumber,
          orderId,
          buyerName,
          listingTitle,
          orderAmount: orderData.amount,
          orderDate: createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          hoursOverdue,
          shippingAddress: formatShippingAddress(orderData.shippingAddress)
        };

        console.log(`[Shipping Reminders] Sending ${qualifyingInterval}h reminder for order ${orderId}`, {
          seller: sellerData.email,
          buyer: buyerName,
          hoursOverdue,
          orderAmount: orderData.amount,
          reminderInterval: qualifyingInterval
        });

        // Send the shipping reminder email
        const emailSent = await emailService.sendShippingReminderEmail(reminderData);

        // Create in-app notification regardless of email success
        await createShippingNotification(db, orderData, orderId, hoursOverdue);
        totalNotifications++;

        if (emailSent) {
          // Record that we sent the reminder
          await db.collection('shippingReminders').add({
            orderId,
            sellerId: orderData.sellerId,
            buyerId: orderData.buyerId,
            sellerEmail: sellerData.email,
            hoursOverdue,
            reminderInterval: qualifyingInterval,
            sentAt: Timestamp.now(),
            orderAmount: orderData.amount,
            listingTitle,
            emailSent: true,
            notificationCreated: true
          });

          totalReminders++;
          processedOrders.push(orderId);
          reminderBreakdown[qualifyingInterval] = (reminderBreakdown[qualifyingInterval] || 0) + 1;
          console.log(`[Shipping Reminders] Successfully sent ${qualifyingInterval}h reminder for order ${orderId}`);
        } else {
          // Still record the attempt even if email failed
          await db.collection('shippingReminders').add({
            orderId,
            sellerId: orderData.sellerId,
            buyerId: orderData.buyerId,
            sellerEmail: sellerData.email,
            hoursOverdue,
            reminderInterval: qualifyingInterval,
            sentAt: Timestamp.now(),
            orderAmount: orderData.amount,
            listingTitle,
            emailSent: false,
            notificationCreated: true,
            error: 'Email sending failed'
          });

          totalErrors++;
          console.error(`[Shipping Reminders] Failed to send email for order ${orderId}, but notification was created`);
        }

      } catch (error) {
        totalErrors++;
        logError('Processing shipping reminder', error, { orderId: orderDoc.id });
      }
    }

    const summary = {
      totalReminders,
      totalNotifications,
      totalErrors,
      processedOrders,
      ordersChecked: eligibleOrders.length,
      reminderBreakdown,
      timestamp: new Date().toISOString()
    };

    console.log('[Shipping Reminders] Enhanced shipping reminder process completed', summary);

    return res.status(200).json({
      message: `Successfully sent ${totalReminders} shipping reminder emails and created ${totalNotifications} notifications`,
      summary
    });

  } catch (error: any) {
    logError('Shipping reminder process', error);
    return res.status(500).json({
      error: 'Failed to process shipping reminders',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}