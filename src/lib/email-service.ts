import { NotificationType, NotificationPreferences } from '@/types/notification';
import { getNotificationEmailTemplate, NotificationEmailData } from './email-templates/notification-templates';
import { getWelcomeEmailTemplate, WelcomeEmailData } from './email-templates/welcome-template';

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