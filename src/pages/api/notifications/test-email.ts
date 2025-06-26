import { NextApiRequest, NextApiResponse } from 'next';
import { emailService } from '@/lib/email-service';
import { notificationService } from '@/lib/notification-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userEmail, userName, type = 'test', listingData, supportData } = req.body;

    if (!userEmail || !userName) {
      return res.status(400).json({ error: 'userEmail and userName are required' });
    }

    let success = false;
    let message = '';

    // Helper function to generate realistic Stripe mock data
    const generateStripeData = (amount: string) => {
      const numAmount = parseFloat(amount);
      const fee = (numAmount * 0.031 + 0.30).toFixed(2);
      const total = (numAmount + parseFloat(fee) + 5.99).toFixed(2); // Add shipping
      
      return {
        transactionId: `pi_test_${Math.random().toString(36).substr(2, 16)}`,
        paymentMethod: 'Visa ending in 4242',
        fee,
        total,
        subtotal: amount,
        shipping: '5.99'
      };
    };

    // Helper function to generate order data from listing
    const generateOrderData = (listing: any, buyer: { name: string; email: string }) => {
      const stripeData = generateStripeData(listing.price);
      const orderNumber = `ORD-${Math.random().toString(36).substr(2, 7).toUpperCase()}`;
      const orderId = `test-order-${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        userName: buyer.name,
        userEmail: buyer.email,
        orderNumber,
        orderDate: new Date().toLocaleDateString(),
        cardName: listing.cardName,
        setName: listing.setName,
        condition: listing.condition,
        quantity: listing.quantity,
        price: listing.price,
        sellerName: listing.sellerName,
        sellerLocation: listing.sellerLocation,
        subtotal: stripeData.subtotal,
        shipping: stripeData.shipping,
        fee: stripeData.fee,
        total: stripeData.total,
        shippingAddress: '123 Main St\nAnytown, CA 12345\nUnited States',
        orderId,
        transactionId: stripeData.transactionId,
        paymentMethod: stripeData.paymentMethod
      };
    };

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

      // New marketplace-specific email types
      case 'marketplace-purchase':
        if (!listingData) {
          return res.status(400).json({ error: 'listingData is required for marketplace-purchase type' });
        }
        
        const buyerOrderData = generateOrderData(listingData, { name: userName, email: userEmail });
        success = await emailService.sendOrderConfirmationEmail(buyerOrderData);
        message = success ? 'Marketplace purchase confirmation email sent successfully' : 'Failed to send marketplace purchase confirmation email';
        break;

      case 'marketplace-sale':
        if (!listingData) {
          return res.status(400).json({ error: 'listingData is required for marketplace-sale type' });
        }
        
        const saleOrderData = generateOrderData(listingData, { name: listingData.buyerName, email: listingData.buyerEmail });
        const saleNotificationData = {
          userName: listingData.sellerName,
          userEmail: userEmail, // Admin testing email
          type: 'sale' as const,
          title: 'New Sale!',
          message: `Congratulations! ${listingData.buyerName} just purchased your ${listingData.cardName} - ${listingData.setName} for $${listingData.price}. Please prepare the item for shipment.`,
          actionUrl: `/dashboard/orders/${saleOrderData.orderId}`,
          data: {
            orderId: saleOrderData.orderId,
            listingId: listingData.listingId
          }
        };
        
        success = await emailService.sendEmailNotification(saleNotificationData);
        message = success ? 'Marketplace sale notification email sent successfully' : 'Failed to send marketplace sale notification email';
        break;

      case 'marketplace-shipping':
        if (!listingData) {
          return res.status(400).json({ error: 'listingData is required for marketplace-shipping type' });
        }
        
        const trackingNumber = `1Z999AA${Math.random().toString().substr(2, 9)}`;
        const marketplaceShippingData = {
          userName,
          userEmail,
          sellerName: listingData.sellerName,
          sellerLocation: listingData.sellerLocation,
          orderNumber: `ORD-${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
          trackingNumber,
          shippingCarrier: 'UPS',
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          shippingAddress: '123 Main St, Anytown, CA 12345',
          trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
          orderId: `test-order-${Math.random().toString(36).substr(2, 9)}`
        };
        
        success = await emailService.sendShippingNotificationEmail(marketplaceShippingData);
        message = success ? 'Marketplace shipping notification email sent successfully' : 'Failed to send marketplace shipping notification email';
        break;

      case 'marketplace-offer':
        if (!listingData) {
          return res.status(400).json({ error: 'listingData is required for marketplace-offer type' });
        }
        
        const offerAmount = (parseFloat(listingData.price) * 0.85).toFixed(2); // 15% below asking price
        const offerNotificationData = {
          userName: listingData.sellerName,
          userEmail: userEmail, // Admin testing email
          type: 'offer' as const,
          title: 'New Offer Received!',
          message: `${userName} has made an offer of $${offerAmount} on your ${listingData.cardName} - ${listingData.setName} listing. Review and respond to this offer in your dashboard.`,
          actionUrl: `/dashboard/offers`,
          data: {
            listingId: listingData.listingId,
            offerAmount,
            buyerName: userName
          }
        };
        
        success = await emailService.sendEmailNotification(offerNotificationData);
        message = success ? 'Marketplace offer notification email sent successfully' : 'Failed to send marketplace offer notification email';
        break;

      case 'marketplace-payment-received':
        if (!listingData) {
          return res.status(400).json({ error: 'listingData is required for marketplace-payment-received type' });
        }
        
        const sellerPaymentData = generateOrderData(listingData, { name: listingData.buyerName, email: listingData.buyerEmail });
        const paymentNotificationData = {
          userName: listingData.sellerName,
          userEmail: userEmail, // Admin testing email
          type: 'order_update' as const,
          title: 'Payment Received!',
          message: `Payment of $${sellerPaymentData.total} has been received for your ${listingData.cardName} - ${listingData.setName} sale. Please prepare the item for shipment and add tracking information.`,
          actionUrl: `/dashboard/orders/${sellerPaymentData.orderId}`,
          data: {
            orderId: sellerPaymentData.orderId,
            amount: sellerPaymentData.total
          }
        };
        
        success = await emailService.sendEmailNotification(paymentNotificationData);
        message = success ? 'Marketplace payment received notification email sent successfully' : 'Failed to send marketplace payment received notification email';
        break;

      case 'marketplace-order-shipped':
        if (!listingData) {
          return res.status(400).json({ error: 'listingData is required for marketplace-order-shipped type' });
        }
        
        const shipTrackingNumber = `1Z999AA${Math.random().toString().substr(2, 9)}`;
        const orderShippedData = {
          userName,
          userEmail,
          sellerName: listingData.sellerName,
          sellerLocation: listingData.sellerLocation,
          orderNumber: `ORD-${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
          trackingNumber: shipTrackingNumber,
          shippingCarrier: 'UPS',
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          shippingAddress: '123 Main St, Anytown, CA 12345',
          trackingUrl: `https://www.ups.com/track?tracknum=${shipTrackingNumber}`,
          orderId: `test-order-${Math.random().toString(36).substr(2, 9)}`
        };
        
        success = await emailService.sendShippingNotificationEmail(orderShippedData);
        message = success ? 'Marketplace order shipped notification email sent successfully' : 'Failed to send marketplace order shipped notification email';
        break;

      // Support ticket email types
      case 'support-ticket':
        if (!supportData) {
          return res.status(400).json({ error: 'supportData is required for support-ticket type' });
        }
        
        const supportTicketData = {
          ticketId: supportData.ticketId,
          userName: supportData.userName || userName,
          userEmail: supportData.userEmail || userEmail,
          subject: supportData.subject,
          category: supportData.category,
          priority: supportData.priority,
          description: supportData.description,
          createdAt: new Date()
        };
        
        success = await emailService.sendSupportTicketEmail(supportTicketData);
        message = success ? 'Support ticket email sent successfully to support team' : 'Failed to send support ticket email';
        break;

      case 'support-confirmation':
        if (!supportData) {
          return res.status(400).json({ error: 'supportData is required for support-confirmation type' });
        }
        
        const supportConfirmationData = {
          ticketId: supportData.ticketId,
          userName: supportData.userName || userName,
          userEmail: supportData.userEmail || userEmail,
          subject: supportData.subject,
          category: supportData.category,
          priority: supportData.priority
        };
        
        success = await emailService.sendSupportConfirmationEmail(supportConfirmationData);
        message = success ? 'Support confirmation email sent successfully to user' : 'Failed to send support confirmation email';
        break;

      default:
        return res.status(400).json({ 
          error: 'Invalid type. Supported types: welcome, order-confirmation, payment-confirmation, shipping, verification, password-reset, notification, full-notification, marketplace-purchase, marketplace-sale, marketplace-shipping, marketplace-offer, marketplace-payment-received, marketplace-order-shipped, support-ticket, support-confirmation' 
        });
    }

    return res.status(200).json({ 
      success,
      message,
      type,
      userEmail,
      userName,
      listingData: listingData || null,
      supportData: supportData || null
    });
  } catch (error) {
    console.error('Error testing email:', error);
    return res.status(500).json({ 
      error: 'Failed to test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}