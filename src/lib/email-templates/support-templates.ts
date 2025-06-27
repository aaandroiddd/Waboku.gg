import { getBaseEmailTemplate } from './base-template';

export interface SupportTicketEmailData {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: string;
  description: string;
  createdAt: Date;
}

export interface SupportConfirmationEmailData {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: string;
}

// Email template for support team notification
export function getSupportTicketEmailTemplate(data: SupportTicketEmailData): { subject: string; html: string; text: string } {
  const { ticketId, userName, userEmail, subject, category, priority, description, createdAt } = data;
  
  const priorityEmoji = {
    'critical': '🚨',
    'high': '⚠️',
    'medium': '📋',
    'low': '📝'
  }[priority] || '📋';

  const categoryDisplay = {
    'account': 'Account Issues',
    'billing': 'Billing & Payments',
    'orders': 'Orders & Shipping',
    'listings': 'Listings & Marketplace',
    'technical': 'Technical Issues',
    'refunds': 'Refunds & Returns',
    'safety': 'Safety & Security',
    'feature': 'Feature Request',
    'other': 'Other'
  }[category] || category;

  const priorityDisplay = {
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  }[priority] || priority;

  const emailSubject = `[Support] ${priorityEmoji} New ${priorityDisplay} Priority Ticket #${ticketId}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${emailSubject}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            background-color: #f8fafc;
            color: #1e293b;
            padding: 20px;
            margin: 0;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        .header {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            padding: 30px;
            text-align: center;
            color: white;
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        
        .content {
            padding: 40px;
        }
        
        .ticket-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .info-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .info-label {
            font-weight: 600;
            color: #374151;
        }
        
        .info-value {
            color: #6b7280;
        }
        
        .priority-critical { color: #dc2626; font-weight: bold; }
        .priority-high { color: #ea580c; font-weight: bold; }
        .priority-medium { color: #d97706; }
        .priority-low { color: #059669; }
        
        .description {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>${priorityEmoji} New Support Ticket #${ticketId}</h1>
        </div>
        <div class="content">
            <h2>Ticket Details</h2>
            
            <div class="ticket-info">
                <div class="info-row">
                    <span class="info-label">Ticket ID:</span>
                    <span class="info-value">#${ticketId}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Subject:</span>
                    <span class="info-value">${subject}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Category:</span>
                    <span class="info-value">${categoryDisplay}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Priority:</span>
                    <span class="info-value priority-${priority}">${priorityDisplay}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Created:</span>
                    <span class="info-value">${createdAt.toLocaleString()}</span>
                </div>
            </div>
            
            <h3>User Information</h3>
            <div class="ticket-info">
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${userName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${userEmail}</span>
                </div>
            </div>
            
            <h3>Description</h3>
            <div class="description">${description.replace(/\n/g, '<br>')}</div>
        </div>
        <div class="footer">
            <p>This ticket was automatically generated from the Waboku.gg support system.</p>
            <p>Please respond to this email or access the admin panel to manage this ticket.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
New Support Ticket #${ticketId}

Ticket Details:
- ID: #${ticketId}
- Subject: ${subject}
- Category: ${categoryDisplay}
- Priority: ${priorityDisplay}
- Created: ${createdAt.toLocaleString()}

User Information:
- Name: ${userName}
- Email: ${userEmail}

Description:
${description}

---
This ticket was automatically generated from the Waboku.gg support system.
Please respond to this email or access the admin panel to manage this ticket.
`;

  return {
    subject: emailSubject,
    html,
    text
  };
}

// Email template for user confirmation
export function getSupportConfirmationEmailTemplate(data: SupportConfirmationEmailData): { subject: string; html: string; text: string } {
  const { ticketId, userName, subject, category, priority } = data;
  
  const categoryDisplay = {
    'account': 'Account Issues',
    'billing': 'Billing & Payments',
    'orders': 'Orders & Shipping',
    'listings': 'Listings & Marketplace',
    'technical': 'Technical Issues',
    'refunds': 'Refunds & Returns',
    'safety': 'Safety & Security',
    'feature': 'Feature Request',
    'other': 'Other'
  }[category] || category;

  const priorityDisplay = {
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  }[priority] || priority;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
  const actionUrl = `${baseUrl}/dashboard`;

  const templateData = {
    userName,
    title: `Support Ticket Created`,
    message: `Thank you for contacting Waboku.gg support! We've received your ticket and our team will review it shortly.

<strong>Ticket Details:</strong>

&nbsp;&nbsp;&nbsp;&nbsp;• Ticket ID: #${ticketId}<br>
&nbsp;&nbsp;&nbsp;&nbsp;• Subject: ${subject}<br>
&nbsp;&nbsp;&nbsp;&nbsp;• Category: ${categoryDisplay}<br>
&nbsp;&nbsp;&nbsp;&nbsp;• Priority: ${priorityDisplay}<br>

<strong>What happens next?</strong>

&nbsp;&nbsp;&nbsp;&nbsp;• Our support team will review your ticket within 24 hours<br>
&nbsp;&nbsp;&nbsp;&nbsp;• ${priority === 'critical' || priority === 'high' ? 'High priority tickets are reviewed first' : 'We respond to tickets in order of priority and submission time'}<br>
&nbsp;&nbsp;&nbsp;&nbsp;• You'll receive an email response once we've reviewed your request<br>

If you need to add more information to your ticket, simply reply to this email with your ticket ID <strong>#${ticketId}</strong> in the subject line.`,
    actionUrl,
    actionText: 'Go to Dashboard',
    type: 'system' as const,
    emoji: '🎫'
  };

  const { html, text } = getBaseEmailTemplate(templateData);

  return {
    subject: `Support Ticket #${ticketId} - We've received your request`,
    html,
    text
  };
}