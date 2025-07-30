import { NextApiRequest, NextApiResponse } from 'next';
import { emailService } from '@/lib/email-service';
import { ShippingReminderData } from '@/lib/email-templates/shipping-reminder-templates';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      userEmail = 'admin@waboku.gg',
      userName = 'Test Seller',
      orderNumber = 'TEST123',
      orderId = 'test-order-id',
      buyerName = 'Test Buyer',
      listingTitle = 'Test Trading Card',
      orderAmount = 25.99,
      orderDate,
      hoursOverdue = 12,
      shippingAddress = 'Test User\n123 Test Street\nTest City, TS 12345\nUnited States'
    } = req.body;

    const reminderData: ShippingReminderData = {
      userName,
      userEmail,
      orderNumber,
      orderId,
      buyerName,
      listingTitle,
      orderAmount,
      orderDate: orderDate || new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      hoursOverdue,
      shippingAddress
    };

    console.log('[Test Shipping Reminder] Sending test email with data:', reminderData);

    const emailSent = await emailService.sendShippingReminderEmail(reminderData);

    if (emailSent) {
      return res.status(200).json({
        success: true,
        message: 'Test shipping reminder email sent successfully',
        data: reminderData
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to send test shipping reminder email'
      });
    }
  } catch (error: any) {
    console.error('[Test Shipping Reminder] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}