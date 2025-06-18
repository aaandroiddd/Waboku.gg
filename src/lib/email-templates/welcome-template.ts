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
        
        .content h2 {
            color: #00bcd4;
            font-size: 20px;
            font-weight: 600;
            margin: 32px 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #2a3441;
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
        
        .cta-button.secondary {
            background: transparent;
            border: 2px solid #00bcd4;
            color: #00bcd4;
        }
        
        .cta-button.secondary:hover {
            background: #00bcd4;
            color: #ffffff;
        }
        
        .info-box {
            background: rgba(0, 188, 212, 0.1);
            border: 1px solid rgba(0, 188, 212, 0.3);
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .info-box-title {
            color: #00bcd4;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .info-box-content {
            color: #c9d1d9;
            font-size: 14px;
        }
        
        .protection-notice {
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .protection-notice-title {
            color: #22c55e;
            font-weight: 600;
            margin-bottom: 8px;
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
            
            .content h2 {
                font-size: 18px;
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