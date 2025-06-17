import { NextApiRequest, NextApiResponse } from 'next';
import { emailService } from '@/lib/email-service';
import { notificationService } from '@/lib/notification-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userEmail, userName, type = 'test' } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ error: 'userEmail and userName are required' });
    }

    // Test different types of emails
    if (type === 'welcome') {
      const result = await emailService.sendWelcomeEmail(userEmail, userName);
      return res.status(200).json({ 
        success: result,
        message: result ? 'Welcome email sent successfully' : 'Failed to send welcome email'
      });
    } else if (type === 'notification') {
      // Test notification email
      const result = await emailService.sendTestEmail(userEmail, userName);
      return res.status(200).json({ 
        success: result,
        message: result ? 'Test notification email sent successfully' : 'Failed to send test notification email'
      });
    } else if (type === 'full-notification') {
      // Test full notification system (in-app + email)
      const notificationId = await notificationService.createNotification({
        userId: 'test-user-id',
        type: 'system',
        title: 'Test Full Notification System',
        message: 'This is a test of the complete notification system including both in-app and email notifications.',
        data: {
          actionUrl: '/dashboard'
        }
      }, true); // sendEmail = true

      return res.status(200).json({ 
        success: true,
        notificationId,
        message: 'Full notification test completed (in-app notification created, email sending attempted)'
      });
    } else {
      return res.status(400).json({ error: 'Invalid type. Use "welcome", "notification", or "full-notification"' });
    }
  } catch (error) {
    console.error('Error testing email:', error);
    return res.status(500).json({ 
      error: 'Failed to test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}