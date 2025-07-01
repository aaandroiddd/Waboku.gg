import { NotificationType, NotificationPreferences } from '@/types/notification';
import { 
  getNotificationEmailTemplate, 
  NotificationEmailData,
  getWelcomeEmailTemplate, 
  WelcomeEmailData,
  getOrderConfirmationTemplate,
  getPaymentConfirmationTemplate,
  getShippingNotificationTemplate,
  getVerificationEmailTemplate,
  getPasswordResetTemplate,
  getOfferReceivedTemplate,
  getOfferAcceptedTemplate,
  getOfferDeclinedTemplate,
  getOfferCounterTemplate,
  getOfferOrderCreatedTemplate,
  getSubscriptionChargeTemplate,
  getSubscriptionSuccessTemplate,
  getSubscriptionCanceledTemplate,
  getSubscriptionFailedTemplate,
  getSubscriptionRenewalReminderTemplate,
  getRefundRequestedTemplate,
  getRefundApprovedTemplate,
  getRefundDeniedTemplate,
  getRefundProcessedTemplate,
  OrderConfirmationData,
  PaymentConfirmationData,
  ShippingNotificationData,
  VerificationEmailData,
  PasswordResetData,
  OfferReceivedData,
  OfferAcceptedData,
  OfferDeclinedData,
  OfferCounterData,
  OfferOrderCreatedData,
  SubscriptionChargeData,
  SubscriptionSuccessData,
  SubscriptionCanceledData,
  SubscriptionFailedData,
  SubscriptionRenewalReminderData,
  RefundRequestedData,
  RefundApprovedData,
  RefundDeniedData,
  RefundProcessedData
} from './email-templates';
import { 
  getSupportTicketEmailTemplate,
  getSupportConfirmationEmailTemplate,
  SupportTicketEmailData,
  SupportConfirmationEmailData
} from './email-templates/support-templates';

// Conditionally import and initialize Resend only on server-side
let Resend: any = null;
let resend: any = null;

// Only initialize Resend on server-side
if (typeof window === 'undefined') {
  try {
    Resend = require('resend').Resend;
    resend = new Resend(process.env.RESEND_API_KEY);
  } catch (error) {
    console.warn('Resend not available:', error);
  }
}

export interface EmailNotificationData {
  userId: string;
  userEmail: string;
  userName: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  data?: {
    listingId?: string;
    orderId?: string;
    offerId?: string;
    messageThreadId?: string;
    [key: string]: any;
  };
}

export class EmailService {
  private static instance: EmailService;
  
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Check if user has email notifications enabled for a specific type
   */
  private shouldSendEmail(preferences: NotificationPreferences | null, type: NotificationType): boolean {
    if (!preferences) {
      // Default to sending emails if no preferences are set
      return true;
    }

    switch (type) {
      case 'sale':
        return preferences.email.sales;
      case 'message':
        return preferences.email.messages;
      case 'offer':
      case 'offer_accepted':
      case 'offer_declined':
        return preferences.email.offers;
      case 'order_update':
        return preferences.email.orderUpdates;
      case 'listing_expired':
        return preferences.email.listingUpdates;
      case 'system':
      case 'moderation':
        return preferences.email.system;
      default:
        return true;
    }
  }

  /**
   * Get email template based on notification type using new template system
   */
  private getEmailTemplate(data: EmailNotificationData): { subject: string; html: string; text: string } {
    const { userName, userEmail, title, message, actionUrl, type } = data;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
    const fullActionUrl = actionUrl ? (actionUrl.startsWith('http') ? actionUrl : `${baseUrl}${actionUrl}`) : `${baseUrl}/dashboard`;

    const notificationData: NotificationEmailData = {
      userName,
      userEmail,
      type,
      title,
      message,
      actionUrl: fullActionUrl,
      data: data.data
    };

    return getNotificationEmailTemplate(notificationData);
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    data: EmailNotificationData,
    preferences: NotificationPreferences | null = null
  ): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      // Check if user wants to receive this type of email
      if (!this.shouldSendEmail(preferences, data.type)) {
        console.log(`Email notification skipped for user ${data.userId} - type ${data.type} disabled in preferences`);
        return false;
      }

      // Get email template
      const { subject, html, text } = this.getEmailTemplate(data);

      // Send email using Resend
      const result = await resend.emails.send({
        from: 'Waboku.gg <notifications@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending email notification:', result.error);
        return false;
      }

      console.log(`Email notification sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Send welcome email to new users using new template system
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping welcome email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const welcomeData: WelcomeEmailData = {
        userName,
        userEmail
      };

      const { subject, html, text } = getWelcomeEmailTemplate(welcomeData);

      const result = await resend.emails.send({
        from: 'Waboku.gg <welcome@waboku.gg>',
        to: [userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending welcome email:', result.error);
        return false;
      }

      console.log(`Welcome email sent successfully to ${userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping order confirmation email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getOrderConfirmationTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <orders@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending order confirmation email:', result.error);
        return false;
      }

      console.log(`Order confirmation email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      return false;
    }
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmationEmail(data: PaymentConfirmationData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping payment confirmation email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getPaymentConfirmationTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <payments@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending payment confirmation email:', result.error);
        return false;
      }

      console.log(`Payment confirmation email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      return false;
    }
  }

  /**
   * Send shipping notification email
   */
  async sendShippingNotificationEmail(data: ShippingNotificationData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping shipping notification email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getShippingNotificationTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <shipping@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending shipping notification email:', result.error);
        return false;
      }

      console.log(`Shipping notification email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending shipping notification email:', error);
      return false;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(data: VerificationEmailData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping verification email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getVerificationEmailTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <verify@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending verification email:', result.error);
        return false;
      }

      console.log(`Verification email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping password reset email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getPasswordResetTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <security@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending password reset email:', result.error);
        return false;
      }

      console.log(`Password reset email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  /**
   * Send offer received email
   */
  async sendOfferReceivedEmail(data: OfferReceivedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping offer received email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getOfferReceivedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <offers@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending offer received email:', result.error);
        return false;
      }

      console.log(`Offer received email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending offer received email:', error);
      return false;
    }
  }

  /**
   * Send offer accepted email
   */
  async sendOfferAcceptedEmail(data: OfferAcceptedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping offer accepted email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getOfferAcceptedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <offers@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending offer accepted email:', result.error);
        return false;
      }

      console.log(`Offer accepted email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending offer accepted email:', error);
      return false;
    }
  }

  /**
   * Send offer declined email
   */
  async sendOfferDeclinedEmail(data: OfferDeclinedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping offer declined email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getOfferDeclinedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <offers@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending offer declined email:', result.error);
        return false;
      }

      console.log(`Offer declined email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending offer declined email:', error);
      return false;
    }
  }

  /**
   * Send offer counter email
   */
  async sendOfferCounterEmail(data: OfferCounterData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping offer counter email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getOfferCounterTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <offers@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending offer counter email:', result.error);
        return false;
      }

      console.log(`Offer counter email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending offer counter email:', error);
      return false;
    }
  }

  /**
   * Send offer order created email
   */
  async sendOfferOrderCreatedEmail(data: OfferOrderCreatedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping offer order created email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getOfferOrderCreatedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <offers@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending offer order created email:', result.error);
        return false;
      }

      console.log(`Offer order created email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending offer order created email:', error);
      return false;
    }
  }

  /**
   * Send subscription charge email
   */
  async sendSubscriptionChargeEmail(data: SubscriptionChargeData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping subscription charge email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSubscriptionChargeTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <billing@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending subscription charge email:', result.error);
        return false;
      }

      console.log(`Subscription charge email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending subscription charge email:', error);
      return false;
    }
  }

  /**
   * Send subscription success email
   */
  async sendSubscriptionSuccessEmail(data: SubscriptionSuccessData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping subscription success email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSubscriptionSuccessTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <billing@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending subscription success email:', result.error);
        return false;
      }

      console.log(`Subscription success email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending subscription success email:', error);
      return false;
    }
  }

  /**
   * Send subscription canceled email
   */
  async sendSubscriptionCanceledEmail(data: SubscriptionCanceledData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping subscription canceled email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSubscriptionCanceledTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <billing@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending subscription canceled email:', result.error);
        return false;
      }

      console.log(`Subscription canceled email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending subscription canceled email:', error);
      return false;
    }
  }

  /**
   * Send subscription failed email
   */
  async sendSubscriptionFailedEmail(data: SubscriptionFailedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping subscription failed email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSubscriptionFailedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <billing@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending subscription failed email:', result.error);
        return false;
      }

      console.log(`Subscription failed email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending subscription failed email:', error);
      return false;
    }
  }

  /**
   * Send subscription renewal reminder email
   */
  async sendSubscriptionRenewalReminderEmail(data: SubscriptionRenewalReminderData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping subscription renewal reminder email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSubscriptionRenewalReminderTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <billing@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending subscription renewal reminder email:', result.error);
        return false;
      }

      console.log(`Subscription renewal reminder email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending subscription renewal reminder email:', error);
      return false;
    }
  }

  /**
   * Send refund requested email
   */
  async sendRefundRequestedEmail(data: RefundRequestedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping refund requested email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getRefundRequestedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <refunds@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending refund requested email:', result.error);
        return false;
      }

      console.log(`Refund requested email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending refund requested email:', error);
      return false;
    }
  }

  /**
   * Send refund approved email
   */
  async sendRefundApprovedEmail(data: RefundApprovedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping refund approved email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getRefundApprovedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <refunds@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending refund approved email:', result.error);
        return false;
      }

      console.log(`Refund approved email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending refund approved email:', error);
      return false;
    }
  }

  /**
   * Send refund denied email
   */
  async sendRefundDeniedEmail(data: RefundDeniedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping refund denied email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getRefundDeniedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <refunds@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending refund denied email:', result.error);
        return false;
      }

      console.log(`Refund denied email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending refund denied email:', error);
      return false;
    }
  }

  /**
   * Send refund processed email
   */
  async sendRefundProcessedEmail(data: RefundProcessedData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping refund processed email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getRefundProcessedTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg <refunds@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending refund processed email:', result.error);
        return false;
      }

      console.log(`Refund processed email sent successfully to ${data.userEmail} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending refund processed email:', error);
      return false;
    }
  }

  /**
   * Send notification email with specific type handling
   */
  async sendNotificationEmail(data: { to: string; type: string; data: any }): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping notification email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      let emailResult = false;

      switch (data.type) {
        case 'refund-requested':
          emailResult = await this.sendRefundRequestedEmail({
            userEmail: data.to,
            ...data.data
          });
          break;
        case 'refund-approved':
          emailResult = await this.sendRefundApprovedEmail({
            userEmail: data.to,
            ...data.data
          });
          break;
        case 'refund-denied':
          emailResult = await this.sendRefundDeniedEmail({
            userEmail: data.to,
            ...data.data
          });
          break;
        case 'refund-processed':
          emailResult = await this.sendRefundProcessedEmail({
            userEmail: data.to,
            ...data.data
          });
          break;
        default:
          console.log(`Unknown notification email type: ${data.type}`);
          return false;
      }

      return emailResult;
    } catch (error) {
      console.error('Error sending notification email:', error);
      return false;
    }
  }

  /**
   * Send support ticket email to support team
   */
  async sendSupportTicketEmail(data: SupportTicketEmailData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping support ticket email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSupportTicketEmailTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg Support <noreply@waboku.gg>',
        to: ['support@waboku.gg'],
        subject,
        html,
        text,
        replyTo: data.userEmail
      });

      if (result.error) {
        console.error('Error sending support ticket email:', result.error);
        return false;
      }

      console.log(`Support ticket email sent successfully for ticket #${data.ticketId} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending support ticket email:', error);
      return false;
    }
  }

  /**
   * Send support confirmation email to user
   */
  async sendSupportConfirmationEmail(data: SupportConfirmationEmailData): Promise<boolean> {
    try {
      // Only send emails on server-side
      if (typeof window !== 'undefined') {
        console.log('Email service called on client-side, skipping support confirmation email send');
        return false;
      }

      // Check if Resend is available
      if (!resend) {
        console.error('Resend service not initialized');
        return false;
      }

      const { subject, html, text } = getSupportConfirmationEmailTemplate(data);

      const result = await resend.emails.send({
        from: 'Waboku.gg Support <support@waboku.gg>',
        to: [data.userEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error('Error sending support confirmation email:', result.error);
        return false;
      }

      console.log(`Support confirmation email sent successfully to ${data.userEmail} for ticket #${data.ticketId} (ID: ${result.data?.id})`);
      return true;
    } catch (error) {
      console.error('Error sending support confirmation email:', error);
      return false;
    }
  }

  /**
   * Send test email (for debugging)
   */
  async sendTestEmail(userEmail: string, userName: string): Promise<boolean> {
    try {
      const testData: EmailNotificationData = {
        userId: 'test-user',
        userEmail,
        userName,
        type: 'system',
        title: 'Test Email Notification',
        message: 'This is a test email to verify that email notifications are working correctly.',
        actionUrl: '/dashboard'
      };

      return await this.sendEmailNotification(testData);
    } catch (error) {
      console.error('Error sending test email:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();