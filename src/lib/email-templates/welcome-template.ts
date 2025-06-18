export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
}

export function getWelcomeEmailTemplate(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const { userName } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '🎉 Welcome to Waboku.gg - Your Trading Card Journey Begins!';

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
    <title>Welcome to Waboku.gg</title>
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
            
            .welcome-title {
                color: ${colors.dark.foreground} !important;
            }
            
            .welcome-message {
                color: ${colors.dark.mutedForeground} !important;
            }
            
            .feature-card {
                background-color: ${colors.dark.accent} !important;
                border-color: ${colors.dark.border} !important;
            }
            
            .feature-title {
                color: ${colors.dark.foreground} !important;
            }
            
            .feature-description {
                color: ${colors.dark.mutedForeground} !important;
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
            background: linear-gradient(135deg, ${colors.light.primary} 0%, #1d4ed8 100%);
            padding: 40px 24px;
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
            font-size: 32px;
            font-weight: 800;
            color: white;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
        }
        
        .header-tagline {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
        }
        
        .welcome-icon {
            font-size: 64px;
            margin-bottom: 16px;
            display: block;
        }
        
        .email-content {
            padding: 40px 32px;
        }
        
        .welcome-title {
            font-size: 28px;
            font-weight: 700;
            color: ${colors.light.foreground};
            margin-bottom: 16px;
            text-align: center;
            line-height: 1.3;
        }
        
        .welcome-message {
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
        
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 32px 0;
        }
        
        .feature-card {
            background-color: ${colors.light.accent};
            border: 1px solid ${colors.light.border};
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            transition: transform 0.2s ease;
        }
        
        .feature-card:hover {
            transform: translateY(-2px);
        }
        
        .feature-icon {
            font-size: 32px;
            margin-bottom: 12px;
            display: block;
        }
        
        .feature-title {
            font-size: 18px;
            font-weight: 600;
            color: ${colors.light.foreground};
            margin-bottom: 8px;
        }
        
        .feature-description {
            font-size: 14px;
            color: ${colors.light.mutedForeground};
            line-height: 1.5;
        }
        
        .cta-container {
            text-align: center;
            margin: 40px 0;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, ${colors.light.primary} 0%, #1d4ed8 100%);
            color: ${colors.light.primaryForeground};
            padding: 18px 36px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
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
                padding: 32px 20px;
            }
            
            .email-content {
                padding: 32px 24px;
            }
            
            .email-footer {
                padding: 24px 20px;
            }
            
            .welcome-title {
                font-size: 24px;
            }
            
            .features-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            
            .feature-card {
                padding: 20px;
            }
            
            .cta-button {
                padding: 16px 28px;
                font-size: 15px;
            }
        }
        
        @media (prefers-reduced-motion: reduce) {
            .cta-button, .feature-card {
                transition: none;
            }
            
            .cta-button:hover, .feature-card:hover {
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
                    <div class="header-tagline">Your Premier Trading Card Marketplace</div>
                    <span class="welcome-icon">🎉</span>
                </div>
            </div>
            
            <!-- Content -->
            <div class="email-content">
                <h1 class="welcome-title">Welcome to Waboku.gg!</h1>
                <div class="welcome-message">
                    <span class="greeting">Hi ${userName},</span><br><br>
                    Welcome to the premier trading card marketplace! We're excited to have you join our community of collectors and traders. Your journey into the world of trading cards starts here.
                </div>
                
                <!-- Features Grid -->
                <div class="features-grid">
                    <div class="feature-card">
                        <span class="feature-icon">🃏</span>
                        <div class="feature-title">Buy & Sell Cards</div>
                        <div class="feature-description">Discover rare cards from popular games like Pokémon, Yu-Gi-Oh!, and more</div>
                    </div>
                    
                    <div class="feature-card">
                        <span class="feature-icon">💰</span>
                        <div class="feature-title">Make Offers</div>
                        <div class="feature-description">Negotiate prices and make deals with other collectors</div>
                    </div>
                    
                    <div class="feature-card">
                        <span class="feature-icon">💬</span>
                        <div class="feature-title">Chat & Connect</div>
                        <div class="feature-description">Message other collectors and build lasting relationships</div>
                    </div>
                    
                    <div class="feature-card">
                        <span class="feature-icon">⭐</span>
                        <div class="feature-title">Build Reputation</div>
                        <div class="feature-description">Earn reviews and establish trust in the community</div>
                    </div>
                </div>
                
                <div class="cta-container">
                    <a href="${baseUrl}/dashboard" class="cta-button">Explore Your Dashboard</a>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="email-footer">
                <div class="footer-text">
                    Ready to start trading? <a href="${baseUrl}/dashboard/create-listing" class="footer-link">Create your first listing</a>
                </div>
                <hr class="divider">
                <div class="footer-text">
                    <a href="${baseUrl}/faq" class="footer-link">Help & FAQ</a> • 
                    <a href="${baseUrl}/dashboard/settings" class="footer-link">Notification Settings</a> • 
                    <a href="${baseUrl}/about" class="footer-link">About Us</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

  const text = `
Welcome to Waboku.gg!

Hi ${userName},

Welcome to the premier trading card marketplace! We're excited to have you join our community of collectors and traders. Your journey into the world of trading cards starts here.

What you can do on Waboku.gg:
🃏 Buy & Sell Cards - Discover rare cards from popular games like Pokémon, Yu-Gi-Oh!, and more
💰 Make Offers - Negotiate prices and make deals with other collectors  
💬 Chat & Connect - Message other collectors and build lasting relationships
⭐ Build Reputation - Earn reviews and establish trust in the community

Get started: ${baseUrl}/dashboard

Ready to start trading? Create your first listing: ${baseUrl}/dashboard/create-listing

Help & FAQ: ${baseUrl}/faq
Notification Settings: ${baseUrl}/dashboard/settings
About Us: ${baseUrl}/about
`;

  return { subject, html, text };
}