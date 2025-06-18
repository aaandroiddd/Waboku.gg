import { getBaseEmailTemplate } from './base-template';

export interface SubscriptionChargeData {
  userName: string;
  userEmail: string;
  amount: number;
  planName: string;
  billingPeriod: string;
  nextBillingDate: string;
  actionUrl: string;
}

export interface SubscriptionSuccessData {
  userName: string;
  userEmail: string;
  amount: number;
  planName: string;
  billingPeriod: string;
  nextBillingDate: string;
  actionUrl: string;
}

export interface SubscriptionCanceledData {
  userName: string;
  userEmail: string;
  planName: string;
  endDate: string;
  actionUrl: string;
}

export interface SubscriptionFailedData {
  userName: string;
  userEmail: string;
  planName: string;
  amount: number;
  retryDate: string;
  actionUrl: string;
}

export interface SubscriptionRenewalReminderData {
  userName: string;
  userEmail: string;
  planName: string;
  amount: number;
  renewalDate: string;
  actionUrl: string;
}

export function getSubscriptionChargeTemplate(data: SubscriptionChargeData): { subject: string; html: string; text: string } {
  const subject = `💳 Subscription Charged: ${data.planName} - $${data.amount.toFixed(2)}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        💳
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Subscription Charged
      </h1>
    </div>

    <div style="background: #f0f9ff; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #3b82f6;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Billing Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dbeafe;">
          <span style="color: #1e40af; font-weight: 500;">Plan:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.planName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dbeafe;">
          <span style="color: #1e40af; font-weight: 500;">Billing Period:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.billingPeriod}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dbeafe;">
          <span style="color: #1e40af; font-weight: 500;">Amount Charged:</span>
          <span style="color: #3b82f6; font-weight: 700; font-size: 18px;">$${data.amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #1e40af; font-weight: 500;">Next Billing Date:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.nextBillingDate}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      Your ${data.planName} subscription has been successfully charged for $${data.amount.toFixed(2)}. 
      Your premium features will continue uninterrupted, and your next billing date is ${data.nextBillingDate}.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.2s ease;">
        View Billing Details
      </a>
    </div>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #10b981;">
      <p style="color: #166534; font-size: 14px; margin: 0; font-weight: 500;">
        ✨ <strong>Premium Benefits:</strong> Enjoy unlimited listings, priority support, advanced analytics, and more exclusive features!
      </p>
    </div>
  `;

  const textContent = `
Subscription Charged

Hi ${data.userName},

Your ${data.planName} subscription has been successfully charged.

Billing Details:
- Plan: ${data.planName}
- Billing Period: ${data.billingPeriod}
- Amount Charged: $${data.amount.toFixed(2)}
- Next Billing Date: ${data.nextBillingDate}

Your premium features will continue uninterrupted.

View your billing details: ${data.actionUrl}

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'View Billing Details'
  });

  return { subject, html, text: textContent };
}

export function getSubscriptionSuccessTemplate(data: SubscriptionSuccessData): { subject: string; html: string; text: string } {
  const subject = `🎉 Welcome to ${data.planName}! Payment Successful`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        🎉
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Welcome to ${data.planName}!
      </h1>
    </div>

    <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #10b981;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Subscription Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dcfce7;">
          <span style="color: #166534; font-weight: 500;">Plan:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.planName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dcfce7;">
          <span style="color: #166534; font-weight: 500;">Billing Period:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.billingPeriod}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dcfce7;">
          <span style="color: #166534; font-weight: 500;">Amount:</span>
          <span style="color: #10b981; font-weight: 700; font-size: 18px;">$${data.amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #166534; font-weight: 500;">Next Billing Date:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.nextBillingDate}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      Congratulations! Your payment of $${data.amount.toFixed(2)} has been successfully processed, and your ${data.planName} subscription is now active. 
      You now have access to all premium features and benefits.
    </p>

    <div style="background: #fffbeb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
      <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
        🚀 Your Premium Benefits Include:
      </h3>
      <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">✨ Unlimited listing creation</li>
        <li style="margin-bottom: 8px;">📊 Advanced sales analytics and insights</li>
        <li style="margin-bottom: 8px;">🎯 Priority customer support</li>
        <li style="margin-bottom: 8px;">🔥 Featured listing placement</li>
        <li style="margin-bottom: 8px;">💼 Bulk listing tools</li>
        <li style="margin-bottom: 8px;">📈 Enhanced seller dashboard</li>
      </ul>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
        Explore Premium Features
      </a>
    </div>
  `;

  const textContent = `
Welcome to ${data.planName}!

Hi ${data.userName},

Congratulations! Your payment of $${data.amount.toFixed(2)} has been successfully processed, and your ${data.planName} subscription is now active.

Subscription Details:
- Plan: ${data.planName}
- Billing Period: ${data.billingPeriod}
- Amount: $${data.amount.toFixed(2)}
- Next Billing Date: ${data.nextBillingDate}

Your Premium Benefits Include:
- Unlimited listing creation
- Advanced sales analytics and insights
- Priority customer support
- Featured listing placement
- Bulk listing tools
- Enhanced seller dashboard

Explore your premium features: ${data.actionUrl}

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Explore Premium Features'
  });

  return { subject, html, text: textContent };
}

export function getSubscriptionCanceledTemplate(data: SubscriptionCanceledData): { subject: string; html: string; text: string } {
  const subject = `😔 Subscription Canceled - We'll Miss You!`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        😔
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Subscription Canceled
      </h1>
    </div>

    <div style="background: #fef2f2; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #ef4444;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Cancellation Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fecaca;">
          <span style="color: #991b1b; font-weight: 500;">Plan:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.planName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #991b1b; font-weight: 500;">Access Until:</span>
          <span style="color: #ef4444; font-weight: 700; font-size: 16px;">${data.endDate}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      We're sorry to see you go! Your ${data.planName} subscription has been canceled as requested. 
      You'll continue to have access to all premium features until ${data.endDate}, and then your account will revert to our free plan.
    </p>

    <div style="background: #f0f9ff; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
      <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
        💡 What You'll Miss:
      </h3>
      <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">✨ Unlimited listing creation</li>
        <li style="margin-bottom: 8px;">📊 Advanced sales analytics</li>
        <li style="margin-bottom: 8px;">🎯 Priority customer support</li>
        <li style="margin-bottom: 8px;">🔥 Featured listing placement</li>
      </ul>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
        Reactivate Subscription
      </a>
    </div>

    <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
        💬 <strong>We'd Love Your Feedback:</strong> Help us improve by letting us know why you canceled. Your input is valuable to us!
      </p>
    </div>
  `;

  const textContent = `
Subscription Canceled

Hi ${data.userName},

We're sorry to see you go! Your ${data.planName} subscription has been canceled as requested.

Cancellation Details:
- Plan: ${data.planName}
- Access Until: ${data.endDate}

You'll continue to have access to all premium features until ${data.endDate}.

You can reactivate your subscription anytime: ${data.actionUrl}

We'd love your feedback on how we can improve. Thank you for being part of our community!

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Reactivate Subscription'
  });

  return { subject, html, text: textContent };
}

export function getSubscriptionFailedTemplate(data: SubscriptionFailedData): { subject: string; html: string; text: string } {
  const subject = `⚠️ Payment Failed - Action Required for ${data.planName}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        ⚠️
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Payment Failed
      </h1>
    </div>

    <div style="background: #fffbeb; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #f59e0b;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Payment Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fef3c7;">
          <span style="color: #92400e; font-weight: 500;">Plan:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.planName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fef3c7;">
          <span style="color: #92400e; font-weight: 500;">Amount:</span>
          <span style="color: #f59e0b; font-weight: 700; font-size: 18px;">$${data.amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #92400e; font-weight: 500;">Next Retry:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.retryDate}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      We were unable to process your payment of $${data.amount.toFixed(2)} for your ${data.planName} subscription. 
      This could be due to insufficient funds, an expired card, or other payment method issues.
    </p>

    <div style="background: #fef2f2; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
      <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
        🚨 What Happens Next:
      </h3>
      <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">We'll automatically retry your payment on ${data.retryDate}</li>
        <li style="margin-bottom: 8px;">Your premium features remain active during the retry period</li>
        <li style="margin-bottom: 8px;">If payment continues to fail, your subscription will be canceled</li>
        <li style="margin-bottom: 8px;">You can update your payment method anytime to avoid interruption</li>
      </ul>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.2s ease;">
        Update Payment Method
      </a>
    </div>

    <div style="background: #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
      <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: 500;">
        💡 <strong>Quick Fix:</strong> Most payment issues can be resolved by updating your payment method or ensuring sufficient funds are available.
      </p>
    </div>
  `;

  const textContent = `
Payment Failed - Action Required

Hi ${data.userName},

We were unable to process your payment of $${data.amount.toFixed(2)} for your ${data.planName} subscription.

Payment Details:
- Plan: ${data.planName}
- Amount: $${data.amount.toFixed(2)}
- Next Retry: ${data.retryDate}

What Happens Next:
- We'll automatically retry your payment on ${data.retryDate}
- Your premium features remain active during the retry period
- If payment continues to fail, your subscription will be canceled
- You can update your payment method anytime to avoid interruption

Update your payment method: ${data.actionUrl}

Most payment issues can be resolved by updating your payment method or ensuring sufficient funds are available.

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Update Payment Method'
  });

  return { subject, html, text: textContent };
}

export function getSubscriptionRenewalReminderTemplate(data: SubscriptionRenewalReminderData): { subject: string; html: string; text: string } {
  const subject = `🔔 Subscription Renewal Reminder - ${data.planName}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        🔔
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Renewal Reminder
      </h1>
    </div>

    <div style="background: #faf5ff; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #8b5cf6;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Upcoming Renewal
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3e8ff;">
          <span style="color: #6b21a8; font-weight: 500;">Plan:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.planName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3e8ff;">
          <span style="color: #6b21a8; font-weight: 500;">Amount:</span>
          <span style="color: #8b5cf6; font-weight: 700; font-size: 18px;">$${data.amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #6b21a8; font-weight: 500;">Renewal Date:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.renewalDate}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      This is a friendly reminder that your ${data.planName} subscription will automatically renew on ${data.renewalDate} for $${data.amount.toFixed(2)}. 
      Your premium features will continue uninterrupted.
    </p>

    <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
      <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
        ✨ What You're Getting:
      </h3>
      <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">🚀 Unlimited listing creation</li>
        <li style="margin-bottom: 8px;">📊 Advanced sales analytics</li>
        <li style="margin-bottom: 8px;">🎯 Priority customer support</li>
        <li style="margin-bottom: 8px;">🔥 Featured listing placement</li>
        <li style="margin-bottom: 8px;">💼 Bulk listing tools</li>
      </ul>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); transition: all 0.2s ease;">
        Manage Subscription
      </a>
    </div>

    <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
        ⚙️ <strong>Need Changes?</strong> You can update your payment method, change your plan, or cancel anytime from your account settings.
      </p>
    </div>
  `;

  const textContent = `
Subscription Renewal Reminder

Hi ${data.userName},

This is a friendly reminder that your ${data.planName} subscription will automatically renew on ${data.renewalDate} for $${data.amount.toFixed(2)}.

Upcoming Renewal:
- Plan: ${data.planName}
- Amount: $${data.amount.toFixed(2)}
- Renewal Date: ${data.renewalDate}

What You're Getting:
- Unlimited listing creation
- Advanced sales analytics
- Priority customer support
- Featured listing placement
- Bulk listing tools

Manage your subscription: ${data.actionUrl}

You can update your payment method, change your plan, or cancel anytime from your account settings.

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Manage Subscription'
  });

  return { subject, html, text: textContent };
}