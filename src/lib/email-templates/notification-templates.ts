import { NotificationType } from '@/types/notification';

export interface NotificationEmailData {
  userName: string;
  userEmail: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  data?: {
    listingId?: string;
    orderId?: string;
    offerId?: string;
    messageThreadId?: string;
    [key: string]: any;
  };
}

export function getNotificationEmailTemplate(data: NotificationEmailData): { subject: string; html: string; text: string } {
  const { userName, type, title, message, actionUrl } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
  const fullActionUrl = actionUrl.startsWith('http') ? actionUrl : `${baseUrl}${actionUrl}`;

  // Get type-specific styling and content
  const typeConfig = getTypeConfiguration(type);
  const subject = `${typeConfig.emoji} ${title}`;

  // Theme colors matching your application
  const colors = {
    light: {
      background: '#ffffff',
      cardBackground: '#ffffff',
      foreground: '#1c2937',
      muted: '#f1f5f9',
      mutedForeground: '#64748b',
      primary: '#3b82f6',
      primaryForeground: '#ffffff',
      border: '#e2e8f0',
      accent: '#f1f5f9',
    },
    dark: {
      background: '#0f172a',
      cardBackground: '#1e293b',
      foreground: '#f8fafc',
      muted: '#334155',
      mutedForeground: '#94a3b8',
      primary: '#0ea5e9',
      primaryForeground: '#f8fafc',
      border: '#334155',
      accent: '#1e293b',
    }
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${title}</title>
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${colors.light.foreground};
            background-color: ${colors.light.background};
            margin: 0;
            padding: 0;
            width: 100% !important;
            min-width: 100%;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            body {
                background-color: ${colors.dark.background} !important;
                color: ${colors.dark.foreground} !important;
            }
            
            .email-container {
                background-color: ${colors.dark.cardBackground} !important;
                border-color: ${colors.dark.border} !important;
            }
            
            .notification-title {
                color: ${colors.dark.foreground} !important;
            }
            
            .notification-message {
                color: ${colors.dark.mutedForeground} !important;
            }
            
            .priority-badge {
                background-color: ${colors.dark.accent} !important;
                color: ${colors.dark.foreground} !important;
                border-color: ${colors.dark.border} !important;
            }
            
            .cta-button {
                background-color: ${colors.dark.primary} !important;
                color: ${colors.dark.primaryForeground} !important;
            }
            
            .footer-text {
                color: ${colors.dark.mutedForeground} !important;
            }
            
            .footer-link {
                color: ${colors.dark.primary} !important;
            }
        }
        
        .email-wrapper {
            width: 100%;
            background-color: ${colors.light.background};
            padding: 20px 0;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: ${colors.light.cardBackground};
            border-radius: 16px;
            border: 1px solid ${colors.light.border};
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .email-header {
            background: ${typeConfig.gradient};
            padding: 32px 24px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .email-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
        }
        
        .header-content {
            position: relative;
            z-index: 1;
        }
        
        .header-logo {
            font-size: 24px;
            font-weight: 800;
            color: white;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
        }
        
        .header-tagline {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 16px;
        }
        
        .notification-icon {
            font-size: 48px;
            margin-bottom: 8px;
            display: block;
        }
        
        .priority-badge {
            display: inline-block;
            background-color: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 8px;
        }
        
        .email-content {
            padding: 40px 32px;
        }
        
        .notification-title {
            font-size: 24px;
            font-weight: 700;
            color: ${colors.light.foreground};
            margin-bottom: 16px;
            text-align: center;
            line-height: 1.3;
        }
        
        .notification-message {
            font-size: 16px;
            color: ${colors.light.mutedForeground};
            margin-bottom: 32px;
            text-align: center;
            line-height: 1.6;
        }
        
        .greeting {
            font-weight: 600;
            color: ${colors.light.foreground};
        }
        
        .cta-container {
            text-align: center;
            margin: 32px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: ${typeConfig.buttonColor};
            color: ${colors.light.primaryForeground};
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px ${typeConfig.shadowColor};
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px ${typeConfig.shadowColor};
        }
        
        .email-footer {
            background-color: ${colors.light.muted};
            padding: 32px;
            text-align: center;
            border-top: 1px solid ${colors.light.border};
        }
        
        .footer-text {
            font-size: 14px;
            color: ${colors.light.mutedForeground};
            margin-bottom: 16px;
            line-height: 1.5;
        }
        
        .footer-link {
            color: ${colors.light.primary};
            text-decoration: none;
            font-weight: 500;
        }
        
        .footer-link:hover {
            text-decoration: underline;
        }
        
        .divider {
            height: 1px;
            background-color: ${colors.light.border};
            margin: 24px 0;
            border: none;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 0 16px;
                border-radius: 12px;
            }
            
            .email-header {
                padding: 24px 20px;
            }
            
            .email-content {
                padding: 32px 24px;
            }
            
            .email-footer {
                padding: 24px 20px;
            }
            
            .notification-title {
                font-size: 20px;
            }
            
            .cta-button {
                padding: 14px 24px;
                font-size: 15px;
            }
        }
        
        @media (prefers-reduced-motion: reduce) {
            .cta-button {
                transition: none;
            }
            
            .cta-button:hover {
                transform: none;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <!-- Header -->
            <div class="email-header">
                <div class="header-content">
                    <div class="header-logo">Waboku.gg</div>
                    <div class="header-tagline">Trading Card Marketplace</div>
                    <span class="notification-icon">${typeConfig.emoji}</span>
                    <div class="priority-badge">${typeConfig.category}</div>
                </div>
            </div>
            
            <!-- Content -->
            <div class="email-content">
                <h1 class="notification-title">${title}</h1>
                <div class="notification-message">
                    <span class="greeting">Hi ${userName},</span><br><br>
                    ${message}
                </div>
                
                <div class="cta-container">
                    <a href="${fullActionUrl}" class="cta-button">${typeConfig.actionText}</a>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="email-footer">
                <div class="footer-text">
                    This email was sent from <a href="${baseUrl}" class="footer-link">Waboku.gg</a>
                </div>
                <hr class="divider">
                <div class="footer-text">
                    <a href="${baseUrl}/dashboard/settings" class="footer-link">Manage notification preferences</a> • 
                    <a href="${baseUrl}/faq" class="footer-link">Help & Support</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

  const text = `
${title}

Hi ${userName},

${message}

${typeConfig.actionText}: ${fullActionUrl}

---
This email was sent from Waboku.gg
Manage your notification preferences: ${baseUrl}/dashboard/settings
Help & Support: ${baseUrl}/faq
`;

  return { subject, html, text };
}

function getTypeConfiguration(type: NotificationType) {
  const configs = {
    sale: {
      emoji: '🎉',
      category: 'Sale',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      buttonColor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.3)',
      actionText: 'View Sale Details'
    },
    message: {
      emoji: '💬',
      category: 'Message',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      buttonColor: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      shadowColor: 'rgba(59, 130, 246, 0.3)',
      actionText: 'View Message'
    },
    offer: {
      emoji: '💰',
      category: 'Offer',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      buttonColor: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.3)',
      actionText: 'View Offer'
    },
    offer_accepted: {
      emoji: '✅',
      category: 'Offer Accepted',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      buttonColor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.3)',
      actionText: 'Complete Purchase'
    },
    offer_declined: {
      emoji: '❌',
      category: 'Offer Declined',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      buttonColor: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      shadowColor: 'rgba(239, 68, 68, 0.3)',
      actionText: 'View Details'
    },
    listing_expired: {
      emoji: '⏰',
      category: 'Listing Update',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      buttonColor: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      shadowColor: 'rgba(139, 92, 246, 0.3)',
      actionText: 'Renew Listing'
    },
    order_update: {
      emoji: '📦',
      category: 'Order Update',
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      buttonColor: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      shadowColor: 'rgba(6, 182, 212, 0.3)',
      actionText: 'Track Order'
    },
    system: {
      emoji: '🔔',
      category: 'System',
      gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      buttonColor: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      shadowColor: 'rgba(107, 114, 128, 0.3)',
      actionText: 'View Dashboard'
    },
    moderation: {
      emoji: '⚠️',
      category: 'Moderation',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      buttonColor: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      shadowColor: 'rgba(239, 68, 68, 0.3)',
      actionText: 'View Details'
    }
  };

  return configs[type] || configs.system;
}