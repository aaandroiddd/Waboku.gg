import { Resend } from 'resend';
import { NotificationType, NotificationPreferences } from '@/types/notification';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
   * Get email template based on notification type
   */
  private getEmailTemplate(data: EmailNotificationData): { subject: string; html: string; text: string } {
    const { userName, title, message, actionUrl, type } = data;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
    const fullActionUrl = actionUrl ? `${baseUrl}${actionUrl}` : `${baseUrl}/dashboard`;

    // Get emoji for notification type
    const getTypeEmoji = (type: NotificationType): string => {
      switch (type) {
        case 'sale': return '🎉';
        case 'message': return '💬';
        case 'offer': return '💰';
        case 'offer_accepted': return '✅';
        case 'offer_declined': return '❌';
        case 'listing_expired': return '⏰';
        case 'order_update': return '📦';
        case 'system': return '🔔';
        case 'moderation': return '⚠️';
        default: return '🔔';
      }
    };

    const emoji = getTypeEmoji(type);
    const subject = `${emoji} ${title}`;

    // HTML template
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background-color: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 32px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 8px;
        }
        .notification-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
            text-align: center;
        }
        .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            text-align: center;
        }
        .cta-button {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin: 0 auto;
            display: block;
            width: fit-content;
        }
        .cta-button:hover {
            background-color: #2563eb;
        }
        .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
        }
        .footer a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Waboku.gg</div>
            <div class="notification-icon">${emoji}</div>
        </div>
        
        <h1 class="title">${title}</h1>
        <p class="message">Hi ${userName},<br><br>${message}</p>
        
        <a href="${fullActionUrl}" class="cta-button">View in Dashboard</a>
        
        <div class="footer">
            <p>
                This email was sent from <a href="${baseUrl}">Waboku.gg</a><br>
                <a href="${baseUrl}/dashboard/settings">Manage your notification preferences</a>
            </p>
        </div>
    </div>
</body>
</html>`;

    // Plain text version
    const text = `
${title}

Hi ${userName},

${message}

View in Dashboard: ${fullActionUrl}

---
This email was sent from Waboku.gg
Manage your notification preferences: ${baseUrl}/dashboard/settings
`;

    return { subject, html, text };
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    data: EmailNotificationData,
    preferences: NotificationPreferences | null = null
  ): Promise<boolean> {
    try {
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
   * Send welcome email to new users
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Waboku.gg</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background-color: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 32px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
        }
        .welcome-icon {
            font-size: 64px;
            margin-bottom: 16px;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
            text-align: center;
        }
        .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            text-align: center;
        }
        .cta-button {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin: 0 auto;
            display: block;
            width: fit-content;
            font-size: 16px;
        }
        .features {
            margin: 32px 0;
            padding: 24px;
            background-color: #f8fafc;
            border-radius: 8px;
        }
        .feature {
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        .feature-icon {
            font-size: 24px;
            margin-right: 12px;
        }
        .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
        }
        .footer a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Waboku.gg</div>
            <div class="welcome-icon">🎉</div>
        </div>
        
        <h1 class="title">Welcome to Waboku.gg!</h1>
        <p class="message">
            Hi ${userName},<br><br>
            Welcome to the premier trading card marketplace! We're excited to have you join our community of collectors and traders.
        </p>
        
        <div class="features">
            <div class="feature">
                <span class="feature-icon">🃏</span>
                <span>Buy and sell trading cards from popular games</span>
            </div>
            <div class="feature">
                <span class="feature-icon">💰</span>
                <span>Make offers and negotiate prices</span>
            </div>
            <div class="feature">
                <span class="feature-icon">💬</span>
                <span>Chat with other collectors</span>
            </div>
            <div class="feature">
                <span class="feature-icon">⭐</span>
                <span>Build your reputation with reviews</span>
            </div>
        </div>
        
        <a href="${baseUrl}/dashboard" class="cta-button">Explore Your Dashboard</a>
        
        <div class="footer">
            <p>
                Need help getting started? <a href="${baseUrl}/faq">Check out our FAQ</a><br>
                <a href="${baseUrl}/dashboard/settings">Manage your notification preferences</a>
            </p>
        </div>
    </div>
</body>
</html>`;

      const text = `
Welcome to Waboku.gg!

Hi ${userName},

Welcome to the premier trading card marketplace! We're excited to have you join our community of collectors and traders.

What you can do on Waboku.gg:
• Buy and sell trading cards from popular games
• Make offers and negotiate prices
• Chat with other collectors
• Build your reputation with reviews

Get started: ${baseUrl}/dashboard

Need help? Check out our FAQ: ${baseUrl}/faq
Manage your notification preferences: ${baseUrl}/dashboard/settings
`;

      const result = await resend.emails.send({
        from: 'Waboku.gg <welcome@waboku.gg>',
        to: [userEmail],
        subject: '🎉 Welcome to Waboku.gg - Your Trading Card Marketplace',
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