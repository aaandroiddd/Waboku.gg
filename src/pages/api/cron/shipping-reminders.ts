import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';
import { Timestamp } from 'firebase-admin/firestore';
import { Order } from '@/types/order';

// Maximum number of operations in a single batch
const BATCH_SIZE = 100;

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

/**
 * Cron job to send shipping reminder emails to sellers
 * Runs every 6 hours to check for orders that need shipping reminders
 * Sends reminders for orders that are 48+ hours old and haven't been shipped
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
    console.log('[Shipping Reminders] Starting shipping reminder process');
    const { db } = getFirebaseAdmin();
    const now = new Date();
    
    // Find orders that are 48+ hours old and need shipping reminders
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    const fortyEightHoursAgoTimestamp = Timestamp.fromDate(fortyEightHoursAgo);
    
    let totalReminders = 0;
    let totalErrors = 0;
    const processedOrders: string[] = [];

    console.log('[Shipping Reminders] Checking for orders needing shipping reminders...');
    
    // Query for orders that need shipping reminders
    const ordersQuery = db.collection('orders')
      .where('status', 'in', ['paid', 'awaiting_shipping'])
      .where('createdAt', '<', fortyEightHoursAgoTimestamp)
      .where('isPickup', '!=', true) // Exclude pickup orders
      .limit(BATCH_SIZE);

    const ordersSnapshot = await ordersQuery.get();

    if (ordersSnapshot.empty) {
      console.log('[Shipping Reminders] No orders found needing shipping reminders');
      return res.status(200).json({
        message: 'No orders found needing shipping reminders',
        summary: {
          totalReminders: 0,
          totalErrors: 0,
          processedOrders: [],
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`[Shipping Reminders] Found ${ordersSnapshot.size} orders that may need shipping reminders`);

    // Process each order
    for (const orderDoc of ordersSnapshot.docs) {
      try {
        const orderData = orderDoc.data() as Order;
        const orderId = orderDoc.id;

        // Skip if already shipped or has tracking info
        if (orderData.status === 'shipped' || orderData.trackingInfo) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - already shipped or has tracking`);
          continue;
        }

        // Check if we've already sent a reminder recently (within last 24 hours)
        const reminderCheckQuery = await db.collection('shippingReminders')
          .where('orderId', '==', orderId)
          .where('sentAt', '>', Timestamp.fromDate(new Date(now.getTime() - (24 * 60 * 60 * 1000))))
          .limit(1)
          .get();

        if (!reminderCheckQuery.empty) {
          console.log(`[Shipping Reminders] Skipping order ${orderId} - reminder already sent within 24 hours`);
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
          const listingDoc = await db.collection('listings').doc(orderData.listingId).get();
          if (listingDoc.exists) {
            listingTitle = listingDoc.data()?.title || 'Unknown Item';
          }
        }

        // Calculate hours overdue
        const createdAt = orderData.createdAt instanceof Timestamp ? orderData.createdAt.toDate() : new Date(orderData.createdAt);
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

        console.log(`[Shipping Reminders] Sending reminder for order ${orderId}`, {
          seller: sellerData.email,
          buyer: buyerName,
          hoursOverdue,
          orderAmount: orderData.amount
        });

        // Send the shipping reminder email
        const emailSent = await emailService.sendShippingReminderEmail(reminderData);

        if (emailSent) {
          // Record that we sent the reminder
          await db.collection('shippingReminders').add({
            orderId,
            sellerId: orderData.sellerId,
            buyerId: orderData.buyerId,
            sellerEmail: sellerData.email,
            hoursOverdue,
            sentAt: Timestamp.now(),
            orderAmount: orderData.amount,
            listingTitle
          });

          totalReminders++;
          processedOrders.push(orderId);
          console.log(`[Shipping Reminders] Successfully sent reminder for order ${orderId}`);
        } else {
          totalErrors++;
          console.error(`[Shipping Reminders] Failed to send reminder for order ${orderId}`);
        }

      } catch (error) {
        totalErrors++;
        logError('Processing shipping reminder', error, { orderId: orderDoc.id });
      }
    }

    const summary = {
      totalReminders,
      totalErrors,
      processedOrders,
      ordersChecked: ordersSnapshot.size,
      timestamp: new Date().toISOString()
    };

    console.log('[Shipping Reminders] Shipping reminder process completed', summary);

    return res.status(200).json({
      message: `Successfully sent ${totalReminders} shipping reminders`,
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