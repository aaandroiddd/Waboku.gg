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

    let success = false;
    let message = '';

    // Test different types of emails
    switch (type) {
      case 'welcome':
        success = await emailService.sendWelcomeEmail(userEmail, userName);
        message = success ? 'Welcome email sent successfully' : 'Failed to send welcome email';
        break;

      case 'order-confirmation':
        const orderData = {
          userName,
          userEmail,
          orderNumber: 'ORD-12345',
          orderDate: new Date().toLocaleDateString(),
          cardName: 'Charizard',
          setName: 'Base Set',
          condition: 'Near Mint',
          quantity: 1,
          price: '299.99',
          sellerName: 'CardCollector123',
          sellerLocation: 'California, USA',
          subtotal: '299.99',
          shipping: '5.99',
          fee: '9.30',
          total: '315.28',
          shippingAddress: '123 Main St\nAnytown, CA 12345\nUnited States',
          orderId: 'test-order-123'
        };
        success = await emailService.sendOrderConfirmationEmail(orderData);
        message = success ? 'Order confirmation email sent successfully' : 'Failed to send order confirmation email';
        break;

      case 'payment-confirmation':
        const paymentData = {
          userName,
          userEmail,
          transactionId: 'TXN-67890',
          paymentMethod: 'Visa ending in 4242',
          amount: '315.28',
          paymentDate: new Date().toLocaleDateString(),
          orderId: 'test-order-123'
        };
        success = await emailService.sendPaymentConfirmationEmail(paymentData);
        message = success ? 'Payment confirmation email sent successfully' : 'Failed to send payment confirmation email';
        break;

      case 'shipping':
        const shippingData = {
          userName,
          userEmail,
          sellerName: 'CardCollector123',
          sellerLocation: 'California, USA',
          orderNumber: 'ORD-12345',
          trackingNumber: '1Z999AA1234567890',
          shippingCarrier: 'UPS',
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          shippingAddress: '123 Main St, Anytown, CA 12345',
          trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA1234567890',
          orderId: 'test-order-123'
        };
        success = await emailService.sendShippingNotificationEmail(shippingData);
        message = success ? 'Shipping notification email sent successfully' : 'Failed to send shipping notification email';
        break;

      case 'verification':
        const verificationData = {
          userName,
          userEmail,
          verificationCode: '123456',
          verificationLink: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?code=123456&email=${encodeURIComponent(userEmail)}`
        };
        success = await emailService.sendVerificationEmail(verificationData);
        message = success ? 'Verification email sent successfully' : 'Failed to send verification email';
        break;

      case 'password-reset':
        const resetData = {
          userName,
          userEmail,
          resetLink: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=test-reset-token-123`
        };
        success = await emailService.sendPasswordResetEmail(resetData);
        message = success ? 'Password reset email sent successfully' : 'Failed to send password reset email';
        break;

      case 'notification':
        success = await emailService.sendTestEmail(userEmail, userName);
        message = success ? 'Test notification email sent successfully' : 'Failed to send test notification email';
        break;

      case 'full-notification':
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

        success = !!notificationId;
        message = success ? 'Full notification test completed (in-app notification created, email sending attempted)' : 'Failed to create full notification test';
        break;

      default:
        return res.status(400).json({ 
          error: 'Invalid type. Supported types: welcome, order-confirmation, payment-confirmation, shipping, verification, password-reset, notification, full-notification' 
        });
    }

    return res.status(200).json({ 
      success,
      message,
      type,
      userEmail,
      userName
    });
  } catch (error) {
    console.error('Error testing email:', error);
    return res.status(500).json({ 
      error: 'Failed to test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}