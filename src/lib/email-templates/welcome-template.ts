export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
}

export function getWelcomeEmailTemplate(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const { userName } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '🎴 Welcome to the community!';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Waboku</title>
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
            background-color: #f8fafc;
            color: #1e293b;
            padding: 20px;
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
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 40px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .logo {
            font-size: 36px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        
        .logo .gg {
            color: #00bcd4;
        }
        
        .tagline {
            color: #cbd5e1;
            font-size: 18px;
            font-weight: 400;
        }
        
        .content {
            padding: 50px;
            background: #ffffff;
        }
        
        .content h1 {
            color: #1e293b;
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 28px;
            text-align: center;
        }
        
        .content h2 {
            color: #00bcd4;
            font-size: 24px;
            font-weight: 600;
            margin: 36px 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .content p {
            margin-bottom: 24px;
            color: #475569;
            font-size: 18px;
            line-height: 1.7;
        }
        
        .cta-button {
            display: inline-block;
            background: #00bcd4;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 18px;
            margin: 24px 8px;
            text-align: center;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(0, 188, 212, 0.3);
        }
        
        .cta-button:hover {
            background: #00acc1;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 188, 212, 0.4);
        }
        
        .cta-button.secondary {
            background: transparent;
            border: 2px solid #00bcd4;
            color: #00bcd4;
            box-shadow: none;
        }
        
        .cta-button.secondary:hover {
            background: #00bcd4;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(0, 188, 212, 0.3);
        }
        
        .info-box {
            background: rgba(0, 188, 212, 0.05);
            border: 1px solid rgba(0, 188, 212, 0.2);
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
        }
        
        .info-box-title {
            color: #00bcd4;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
        }
        
        .info-box-content {
            color: #475569;
            font-size: 16px;
            line-height: 1.6;
        }
        
        .protection-notice {
            background: rgba(34, 197, 94, 0.05);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
        }
        
        .protection-notice-title {
            color: #22c55e;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
        }
        
        .footer {
            background: #f8fafc;
            padding: 40px 50px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer p {
            margin: 10px 0;
            color: #64748b;
            font-size: 16px;
        }
        
        .social-links {
            margin: 24px 0;
        }
        
        .social-links a {
            color: #00bcd4;
            text-decoration: none;
            margin: 0 16px;
            font-size: 16px;
            font-weight: 500;
        }
        
        /* Mobile styles - keep original dark theme */
        @media only screen and (max-width: 600px) {
            body {
                background-color: #0f1419;
                color: #ffffff;
                padding: 0;
            }
            
            .email-container {
                max-width: 100%;
                margin: 0;
                border-radius: 0;
                background: #1e2328;
                border: none;
                box-shadow: none;
            }
            
            .header {
                background: linear-gradient(135deg, #1e2328 0%, #2a3441 100%);
                padding: 24px 20px;
                border-bottom: 1px solid #2a3441;
            }
            
            .logo {
                font-size: 28px;
                color: #ffffff;
            }
            
            .tagline {
                color: #8c9aad;
                font-size: 16px;
            }
            
            .content {
                padding: 24px 20px;
                background: #1e2328;
            }
            
            .content h1 {
                color: #ffffff;
                font-size: 24px;
            }
            
            .content h2 {
                color: #00bcd4;
                font-size: 18px;
                border-bottom: 1px solid #2a3441;
            }
            
            .content p {
                color: #c9d1d9;
                font-size: 16px;
                margin-bottom: 20px;
            }
            
            .cta-button {
                padding: 14px 28px;
                font-size: 16px;
                margin: 20px 4px;
                box-shadow: none;
            }
            
            .info-box {
                background: rgba(0, 188, 212, 0.1);
                border: 1px solid rgba(0, 188, 212, 0.3);
                padding: 16px;
                margin: 20px 0;
            }
            
            .info-box-title {
                font-size: 16px;
            }
            
            .info-box-content {
                color: #c9d1d9;
                font-size: 14px;
            }
            
            .protection-notice {
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                padding: 16px;
                margin: 20px 0;
            }
            
            .protection-notice-title {
                font-size: 16px;
            }
            
            .footer {
                background: #0f1419;
                padding: 32px 20px;
                border-top: 1px solid #2a3441;
            }
            
            .footer p {
                color: #8c9aad;
                font-size: 14px;
                margin: 8px 0;
            }
            
            .social-links a {
                font-size: 14px;
                margin: 0 12px;
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
            <h1>Welcome to the community! 🎴</h1>
            <p>Hey ${userName},</p>
            <p>Welcome to <strong>Waboku</strong> - where collectors connect to buy, sell, and trade their favorite TCG cards! You've just joined a thriving community of passionate collectors and players.</p>
            
            <div class="info-box">
                <div class="info-box-title">🌟 How Waboku Works</div>
                <div class="info-box-content">Waboku connects buyers and sellers directly. Browse listings from verified community members, make offers, and discover rare cards from fellow collectors near you.</div>
            </div>
            
            <p>Here's what you can do right now:</p>
            <p>• <strong>Browse listings</strong> from verified sellers in your area<br>
            • <strong>Save favorites</strong> and get notifications when similar cards are listed<br>
            • <strong>Create your first listing</strong> to sell cards from your collection<br>
            • <strong>Message sellers</strong> directly to ask questions or negotiate prices</p>
            
            <div style="text-align: center;">
                <a href="${baseUrl}" class="cta-button">Start Browsing</a>
                <a href="${baseUrl}/dashboard/create-listing" class="cta-button secondary">Create Your First Listing</a>
            </div>
            
            <div class="protection-notice">
                <div class="protection-notice-title">🛡️ Safe Trading</div>
                <div class="info-box-content">All transactions are protected by our secure payment system and buyer protection policies. Trade with confidence!</div>
            </div>
            
            <p>Questions? Our community support team is here to help you get started.</p>
            
            <p>Happy collecting!<br>
            <strong>The Waboku Team</strong></p>
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

  const text = `
Welcome to the community! 🎴

Hey ${userName},

Welcome to Waboku - where collectors connect to buy, sell, and trade their favorite TCG cards! You've just joined a thriving community of passionate collectors and players.

🌟 How Waboku Works
Waboku connects buyers and sellers directly. Browse listings from verified community members, make offers, and discover rare cards from fellow collectors near you.

Here's what you can do right now:
• Browse listings from verified sellers in your area
• Save favorites and get notifications when similar cards are listed
• Create your first listing to sell cards from your collection
• Message sellers directly to ask questions or negotiate prices

Start Browsing: ${baseUrl}
Create Your First Listing: ${baseUrl}/dashboard/create-listing

🛡️ Safe Trading
All transactions are protected by our secure payment system and buyer protection policies. Trade with confidence!

Questions? Our community support team is here to help you get started.

Happy collecting!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}