// Base email template with comprehensive Waboku styling
export interface EmailTemplateData {
  userName: string;
  title: string;
  message: string;
  actionUrl: string;
  actionText?: string;
  type: 'notification' | 'welcome' | 'system';
  emoji?: string;
}

export function getBaseEmailTemplate(data: EmailTemplateData): { html: string; text: string } {
  const { userName, title, message, actionUrl, actionText = 'View in Dashboard', type, emoji = '🔔' } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        /* Reset and base styles for email clients */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            background-color: #0f1419;
            color: #ffffff;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #1e2328;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            border: 1px solid #2a3441;
        }
        
        .header {
            background: linear-gradient(135deg, #1e2328 0%, #2a3441 100%);
            padding: 40px;
            text-align: center;
            border-bottom: 1px solid #2a3441;
        }
        
        .logo {
            font-size: 32px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        
        .logo .gg {
            color: #00bcd4;
        }
        
        .tagline {
            color: #8c9aad;
            font-size: 16px;
            font-weight: 400;
        }
        
        .content {
            padding: 40px;
            background: #1e2328;
        }
        
        .content h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 24px;
            text-align: center;
        }
        
        .content p {
            margin-bottom: 20px;
            color: #c9d1d9;
            font-size: 16px;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            background: #00bcd4;
            color: #ffffff;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
            transition: all 0.2s ease;
        }
        
        .cta-button:hover {
            background: #00acc1;
            transform: translateY(-1px);
        }
        
        .footer {
            background: #0f1419;
            padding: 32px 40px;
            text-align: center;
            border-top: 1px solid #2a3441;
        }
        
        .footer p {
            margin: 8px 0;
            color: #8c9aad;
            font-size: 14px;
        }
        
        .social-links {
            margin: 20px 0;
        }
        
        .social-links a {
            color: #00bcd4;
            text-decoration: none;
            margin: 0 12px;
            font-size: 14px;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content, .footer {
                padding: 24px 20px;
            }
            
            .logo {
                font-size: 28px;
            }
            
            .content h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">waboku<span class="gg">.gg</span></div>
            <div class="tagline">Your Local TCG Marketplace</div>
        </div>
        <div class="content">
            <h1>${title} ${emoji}</h1>
            <p>Hey ${userName},</p>
            <p>${message}</p>
            
            <div style="text-align: center;">
                <a href="${actionUrl}" class="cta-button">${actionText}</a>
            </div>
        </div>
        <div class="footer">
            <div class="social-links">
                <a href="#">Discord</a>
                <a href="#">Twitter</a>
                <a href="#">Instagram</a>
            </div>
            <p>© 2025 Waboku. All rights reserved.</p>
            <p>Questions? Contact us at support@waboku.gg</p>
        </div>
    </div>
</body>
</html>`;

  // Plain text version
  const text = `
${title}

Hi ${userName},

${message}

${actionText}: ${actionUrl}

---
This email was sent from Waboku.gg
Questions? Contact us at support@waboku.gg
© 2025 Waboku. All rights reserved.
`;

  return { html, text };
}